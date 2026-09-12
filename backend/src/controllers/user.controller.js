const crypto = require('crypto');
const { Utilisateur } = require('../models/user.model');
const { Tenant } = require('../models/tenant.model');
const { sendResetPasswordEmail, sendTwoFactorDisabledEmail } = require('../services/email.service');
const { v4: uuidv4 } = require('uuid');
const { revokeAllForPrincipal } = require('../services/session.service');
const { PRINCIPAL_UTILISATEUR } = require('../utils/principals');
const { audit } = require('../utils/saas-log.util');
const logger = require('../utils/logger.util');
const { literalRegex } = require('../utils/regex.util');
// AUTH-008 (audit) : refus des mots de passe créés figurant dans des fuites.
const { verifierFuite } = require('../utils/breach.util');
const { parametresPagination, envelopePagination } = require('../utils/pagination.util');

/** Empreinte SHA-256 (jetons de reset stockés hashés — CFG-002). */
const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');

/**
 * Gestion des utilisateurs D'UN TENANT — Tenant Admin de ce tenant,
 * ou Super Admin (cross-tenant / impersonation).
 *
 * Sécurité :
 * - le périmètre tenant est TOUJOURS imposé par le serveur
 * - les comptes PLATFORM_ADMIN ne sont ni visibles, ni modifiables ici
 * - les licences du tenant limitent le nombre d'utilisateurs actifs
 */

// Aucune donnée sensible exposée : mot de passe, jetons, SECRET 2FA et codes de secours
const SANS_SECRETS = '-password -resetToken -resetTokenExpiry -twoFactorSecret -twoFactorBackupCodes';

/** Tenant cible de l'opération (soit le tenant du JWT, soit un tenant explicite pour le Super Admin). */
const resolveTargetTenant = async (req, res) => {
  if (req.userRole === 'PLATFORM_ADMIN') {
    const id = req.body?.tenantId || req.query.tenantId || req.tenantId;
    if (!id) {
      res.status(400).json({ message: 'tenantId requis pour un Super Admin (création cross-tenant)' });
      return null;
    }
    const tenant = await Tenant.findOne({ _id: id, status: { $ne: 'terminated' } });
    if (!tenant) {
      res.status(404).json({ message: 'Tenant introuvable' });
      return null;
    }
    return tenant;
  }
  if (!req.tenantId) {
    res.status(403).json({ message: 'Aucun tenant associé à ce compte.' });
    return null;
  }
  return Tenant.findById(req.tenantId);
};

/** Liste des utilisateurs du tenant (Super Admin : ?tenantId=... requis). */
const getAllUsers = async (req, res) => {
  try {
    // PERF-002 (audit) : liste paginée + filtres serveur (page/limit,
    // défaut 50, plafond 100).
    const { page, limit, skip } = parametresPagination(req);
    const filter = { role: { $ne: 'PLATFORM_ADMIN' } };
    if (req.userRole === 'PLATFORM_ADMIN') {
      if (!req.query.tenantId) {
        filter.tenantId = { $exists: true };
      } else {
        filter.tenantId = req.query.tenantId;
      }
    } else {
      filter.tenantId = req.tenantId;
    }
    if (typeof req.query.role === 'string' && req.query.role) filter.role = req.query.role.slice(0, 30);
    if (typeof req.query.statut === 'string' && req.query.statut) filter.status = req.query.statut.slice(0, 30);
    if (typeof req.query.recherche === 'string' && req.query.recherche.trim()) {
      const r = literalRegex(req.query.recherche.trim().slice(0, 100));
      filter.$or = [{ email: r }, { firstName: r }, { lastName: r }, { department: r }];
    }
    const [total, items] = await Promise.all([
      Utilisateur.countDocuments(filter),
      Utilisateur.find(filter).select(SANS_SECRETS).sort({ createdAt: -1 }).skip(skip).limit(limit),
    ]);
    res.status(200).json(envelopePagination({ items, total, page, limit }));
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

/** Bilan licences du tenant : achetées / consommées / restantes.
 *  Super Admin GLOBAL (sans tenantId) : agrégat plateforme de tous les
 *  tenants — jamais d'erreur 400 sur la page Utilisateurs plateforme. */
const getLicenses = async (req, res) => {
  try {
    if (req.userRole === 'PLATFORM_ADMIN') {
      const explicitId = req.body?.tenantId || req.query.tenantId || req.tenantId;
      if (!explicitId) {
        const tenants = await Tenant.find({ status: { $ne: 'terminated' } }).lean();
        let maxUsers = 0;
        let activeUsers = 0;
        for (const t of tenants) {
          maxUsers += t.maxUsers || 0;
          activeUsers += await Utilisateur.countDocuments({
            tenantId: t._id,
            status: { $ne: 'suspended' },
            role: { $ne: 'PLATFORM_ADMIN' },
          });
        }
        res.status(200).json({ maxUsers, activeUsers, remainingUsers: Math.max(0, maxUsers - activeUsers), global: true });
        return;
      }
    }
    const tenant = await resolveTargetTenant(req, res);
    if (!tenant) return;
    res.status(200).json(await tenant.licenseInfo());
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

/**
 * Créer un utilisateur interne dans le tenant (rôles RBAC internes
 * uniquement — un compte « client » ne se crée plus ici : l'entité Client
 * porte son propre accès portail, provisionné via /api/clients).
 * Licences : le nombre d'utilisateurs ACTIFS ne peut pas dépasser
 * `tenant.maxUsers` (validation côté serveur, jamais côté client).
 */
const createUser = async (req, res) => {
  try {
    const tenant = await resolveTargetTenant(req, res);
    if (!tenant) return;

    const role = req.body.role || 'VIEWER';

    const existing = await Utilisateur.findOne({ email: req.body.email });
    if (existing) {
      res.status(409).json({ message: 'Cet email est déjà utilisé' });
      return;
    }

    // AUTH-008 : le mot de passe créé ne doit pas figurer dans des fuites.
    const fuiteCreation = await verifierFuite(req.body.password);
    if (fuiteCreation.compromis) {
      res.status(400).json({ message: 'Ce mot de passe figure dans des fuites connues — choisissez-en un autre.', code: 'PASSWORD_BREACHED' });
      return;
    }

    // Contrôle des licences (sièges = utilisateurs non suspendus)
    const licence = await tenant.licenseInfo();
    if (licence.remainingUsers <= 0) {
      res.status(409).json({
        message: `Limite de licences atteinte : ${licence.activeUsers}/${licence.maxUsers} utilisateurs actifs. Augmentez l'abonnement ou suspendez un compte.`,
        licence,
      });
      return;
    }

    const user = new Utilisateur({
      tenantId: tenant._id,
      email: req.body.email,
      password: req.body.password,
      role,
      department: req.body.department || '',
      // CT-003 (audit) : statut honoré (« invited » ou « active », défaut active).
      status: req.body.status === 'invited' ? 'invited' : 'active',
    });
    await user.save();
    // LOG-001 : création de compte interne tracée.
    await audit(req, {
      tenantId: tenant._id,
      action: 'user.created', resource: 'user', resourceId: user._id,
      metadata: { email: user.email, role, department: user.department || '', status: user.status },
    });

    const clean = await Utilisateur.findById(user._id).select(SANS_SECRETS);
    res.status(201).json({ user: clean, licence: await tenant.licenseInfo() });
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

/**
 * Modifier un utilisateur interne du tenant (rôle, département, statut).
 * Suspendre un compte libère un siège de licence ; réactiver en consomme un.
 */
const updateUser = async (req, res) => {
  try {
    const tenant = await resolveTargetTenant(req, res);
    if (!tenant) return;

    const user = await Utilisateur.findOne({
      _id: req.params.id,
      tenantId: tenant._id,
      role: { $ne: 'PLATFORM_ADMIN' },
    });
    if (!user) {
      res.status(404).json({ message: 'Utilisateur introuvable dans ce tenant' });
      return;
    }
    if (String(user._id) === String(req.userId) && req.body.status && req.body.status !== user.status) {
      res.status(409).json({ message: 'Vous ne pouvez pas modifier le statut de votre propre compte.' });
      return;
    }
    // AUTHZ-004 (audit) : nul ne peut changer SON PROPRE rôle (auto-élévation
    // ou contournement d'une rétrogradation imminente).
    if (String(user._id) === String(req.userId) && req.body.role !== undefined && req.body.role !== user.role) {
      res.status(409).json({ message: 'Vous ne pouvez pas modifier le rôle de votre propre compte.' });
      return;
    }

    // Réactivation => consomme un siège : vérifier les licences disponibles
    const devientActif = req.body.status === 'active' && user.status === 'suspended';
    if (devientActif) {
      const licence = await tenant.licenseInfo();
      if (licence.remainingUsers <= 0) {
        res.status(409).json({
          message: `Limite de licences atteinte : ${licence.activeUsers}/${licence.maxUsers}. Impossible de réactiver ce compte.`,
          licence,
        });
        return;
      }
    }

    const { role, department, status, resetTwoFactor } = req.body;

    // Événements de sécurité (AUTH-003) : rôle modifié, suspension/réactivation,
    // reset 2FA ⇒ révocation immédiate des sessions existantes du compte.
    const evenementSecurite =
      (role !== undefined && role !== user.role) ||
      (status !== undefined && status !== user.status) ||
      resetTwoFactor === true;

    if (role !== undefined) user.role = role;
    if (department !== undefined) user.department = department;
    if (status !== undefined) user.status = status;

    // Réinitialisation 2FA par l'admin (compte verrouillé / téléphone perdu).
    // L'admin ne voit JAMAIS le secret : il invalide simplement la configuration,
    // l'utilisateur la recréera lui-même depuis son profil.
    if (resetTwoFactor === true) {
      user.twoFactorEnabled = false;
      user.twoFactorSecret = null;
      user.twoFactorVerified = false;
      user.twoFactorCreatedAt = null;
      user.twoFactorBackupCodes = [];
      sendTwoFactorDisabledEmail(user.email).catch(console.error);
    }
    if (evenementSecurite) {
      user.tokenVersion = (user.tokenVersion || 0) + 1;
    }
    await user.save();
    if (evenementSecurite) {
      await revokeAllForPrincipal(user._id, PRINCIPAL_UTILISATEUR);
    }
    // LOG-001 : modification de compte interne tracée (rôle/statut/dépt/2FA).
    await audit(req, {
      tenantId: tenant._id,
      action: 'user.updated', resource: 'user', resourceId: user._id,
      metadata: {
        ...(role !== undefined ? { role } : {}),
        ...(status !== undefined ? { status } : {}),
        ...(department !== undefined ? { department } : {}),
        ...(resetTwoFactor === true ? { resetTwoFactor: true } : {}),
        ...(evenementSecurite ? { sessionsRevoquees: true } : {}),
      },
    });

    const clean = await Utilisateur.findById(user._id).select(SANS_SECRETS);
    res.status(200).json({ user: clean, licence: await tenant.licenseInfo() });
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

/** Déclenche la réinitialisation du mot de passe d'un utilisateur du tenant. */
const resetUserPassword = async (req, res) => {
  try {
    const tenant = await resolveTargetTenant(req, res);
    if (!tenant) return;

    const user = await Utilisateur.findOne({
      _id: req.params.id,
      tenantId: tenant._id,
      role: { $ne: 'PLATFORM_ADMIN' },
    });
    if (!user) {
      res.status(404).json({ message: 'Utilisateur introuvable dans ce tenant' });
      return;
    }

    // CFG-002 (audit) : le jeton est stocké HASHÉ (SHA-256) — jamais en clair.
    const token = uuidv4();
    user.resetToken = sha256(token);
    user.resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();
    sendResetPasswordEmail(user.email, token).catch(console.error);
    // LOG-001 : envoi d'un lien de réinitialisation tracé (sans le jeton).
    await audit(req, { tenantId: tenant._id, action: 'user.password_reset_requested', resource: 'user', resourceId: user._id });

    res.status(200).json({ message: `Un lien de réinitialisation a été envoyé à ${user.email}` });
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

/** Supprimer un utilisateur du tenant (sauf soi-même et les comptes plateforme). */
const deleteUser = async (req, res) => {
  try {
    const tenant = await resolveTargetTenant(req, res);
    if (!tenant) return;

    const user = await Utilisateur.findOne({
      _id: req.params.id,
      tenantId: tenant._id,
      role: { $ne: 'PLATFORM_ADMIN' },
    });
    if (!user) {
      res.status(404).json({ message: 'Utilisateur introuvable dans ce tenant' });
      return;
    }
    if (String(user._id) === String(req.userId)) {
      res.status(409).json({ message: 'Vous ne pouvez pas supprimer votre propre compte.' });
      return;
    }

    // AUTH-003 : révoque les sessions / jetons de rafraîchissement du compte supprimé.
    await revokeAllForPrincipal(user._id, PRINCIPAL_UTILISATEUR);

    // DB-004 (audit) : purge des références fonctionnelles du compte supprimé —
    // licences, appartenances projet, affectations (tickets / tâches passent à
    // « non affecté » plutôt que de pointer vers un compte inexistant).
    const { LicenseAssignment, RoleAssignment } = require('../models/saas.models');
    const { ProjectMember, Task } = require('../models/project.models');
    const { Ticket } = require('../models/ticket.model');
    await Promise.all([
      LicenseAssignment.deleteMany({ userId: user._id }),
      RoleAssignment.deleteMany({ userId: user._id }),
      ProjectMember.deleteMany({ userId: user._id }),
      Task.updateMany({ assigneeId: user._id }, { $set: { assigneeId: null } }),
      Ticket.updateMany({ assignedTo: user._id }, { $set: { assignedTo: null } }),
    ]);

    const ficheSupprimee = { email: user.email, role: user.role };
    await user.deleteOne();
    // LOG-001 : suppression tracée (la fiche n'existe plus ensuite).
    await audit(req, { tenantId: tenant._id, action: 'user.deleted', resource: 'user', resourceId: req.params.id, metadata: ficheSupprimee });
    res.status(200).json({ message: 'Utilisateur supprimé avec succès', licence: await tenant.licenseInfo() });
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

module.exports = { getAllUsers, getLicenses, createUser, updateUser, resetUserPassword, deleteUser };
