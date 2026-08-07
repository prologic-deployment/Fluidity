const { Utilisateur } = require('../models/user.model');
const { Tenant } = require('../models/tenant.model');
const { Client } = require('../models/client.model');
const { attachClientByEmail } = require('../utils/client-link.util');
const { sendResetPasswordEmail, sendTwoFactorDisabledEmail } = require('../services/email.service');
const { v4: uuidv4 } = require('uuid');

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

// Fiche société peuplée en lecture (nom + statut suffisent à l'affichage)
const PEUPLE_CLIENT = { path: 'clientId', select: 'nom statut' };

/**
 * Valide le rattachement demandé à une fiche Client DU TENANT cible.
 * (Réservé aux comptes CLIENT — contrôlé par l'appelant.)
 * Renvoie le document Client, ou null après avoir déjà répondu 400.
 */
const verifierClientDuTenant = async (tenant, clientId, res) => {
  const client = await Client.findOne({ _id: clientId, tenantId: tenant._id });
  if (!client) {
    res.status(400).json({ message: 'Société cliente introuvable dans ce tenant.' });
    return null;
  }
  return client;
};

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
    const filter = { role: { $ne: 'PLATFORM_ADMIN' } };
    if (req.userRole === 'PLATFORM_ADMIN') {
      if (!req.query.tenantId) {
        const users = await Utilisateur.find(filter).select(SANS_SECRETS).populate(PEUPLE_CLIENT).sort({ createdAt: -1 });
        res.status(200).json(users);
        return;
      }
      filter.tenantId = req.query.tenantId;
    } else {
      filter.tenantId = req.tenantId;
    }
    const users = await Utilisateur.find(filter).select(SANS_SECRETS).populate(PEUPLE_CLIENT).sort({ createdAt: -1 });
    res.status(200).json(users);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

/** Bilan licences du tenant : achetées / consommées / restantes. */
const getLicenses = async (req, res) => {
  try {
    const tenant = await resolveTargetTenant(req, res);
    if (!tenant) return;
    res.status(200).json(await tenant.licenseInfo());
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

/**
 * Créer un utilisateur dans le tenant.
 * Licences : le nombre d'utilisateurs ACTIFS ne peut pas dépasser
 * `tenant.maxUsers` (validation côté serveur, jamais côté client).
 * Rattachement métier : un compte CLIENT peut être lié explicitement à sa
 * fiche société (`clientId`) ; à défaut la fiche de même email est utilisée
 * (auto-rattachement, voir utils/client-link.util.js).
 */
const createUser = async (req, res) => {
  try {
    const tenant = await resolveTargetTenant(req, res);
    if (!tenant) return;

    const role = req.body.role || 'CLIENT';

    const existing = await Utilisateur.findOne({ email: req.body.email });
    if (existing) {
      res.status(409).json({ message: 'Cet email est déjà utilisé' });
      return;
    }

    // Rattachement société : explicite (validé dans le tenant) — sinon auto par email
    if (req.body.clientId && role !== 'CLIENT') {
      res.status(400).json({ message: 'Le rattachement à une fiche client est réservé aux comptes de rôle CLIENT.' });
      return;
    }
    let clientId = null;
    if (req.body.clientId) {
      const client = await verifierClientDuTenant(tenant, req.body.clientId, res);
      if (!client) return;
      clientId = client._id;
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
      status: 'active',
      clientId,
    });
    await attachClientByEmail(tenant._id, user);
    await user.save();

    const clean = await Utilisateur.findById(user._id).select(SANS_SECRETS).populate(PEUPLE_CLIENT);
    res.status(201).json({ user: clean, licence: await tenant.licenseInfo() });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

/**
 * Modifier un utilisateur du tenant (rôle, département, statut, rattachement client).
 * Suspendre un compte libère un siège de licence ; réactiver en consomme un.
 * Cohérence RBAC : `clientId` n'existe que pour les comptes CLIENT — quitter
 * le rôle CLIENT détache la fiche ; y entrer sans `clientId` explicite tente
 * l'auto-rattachement par email.
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

    const { role, department, status, resetTwoFactor, clientId } = req.body;
    const roleFinal = role !== undefined ? role : user.role;

    // Rattachement société : uniquement cohérent pour un compte CLIENT
    if (clientId !== undefined && clientId !== null && roleFinal !== 'CLIENT') {
      res.status(400).json({ message: 'Le rattachement à une fiche client est réservé aux comptes de rôle CLIENT.' });
      return;
    }

    if (role !== undefined) user.role = role;
    if (department !== undefined) user.department = department;
    if (status !== undefined) user.status = status;

    // Quitter le rôle CLIENT => détacher la fiche (elle ne concerne que le portail client)
    if (roleFinal !== 'CLIENT') {
      user.clientId = null;
    } else if (clientId !== undefined) {
      if (clientId === null) {
        user.clientId = null; // détachement explicite autorisé
      } else {
        const client = await verifierClientDuTenant(tenant, clientId, res);
        if (!client) return;
        user.clientId = client._id;
      }
    } else if (!user.clientId) {
      // Bascule/ création sans choix explicite : rattachement automatique par email
      await attachClientByEmail(tenant._id, user);
    }

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
    await user.save();

    const clean = await Utilisateur.findById(user._id).select(SANS_SECRETS).populate(PEUPLE_CLIENT);
    res.status(200).json({ user: clean, licence: await tenant.licenseInfo() });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
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

    const token = uuidv4();
    user.resetToken = token;
    user.resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();
    sendResetPasswordEmail(user.email, token).catch(console.error);

    res.status(200).json({ message: `Un lien de réinitialisation a été envoyé à ${user.email}` });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
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

    await user.deleteOne();
    res.status(200).json({ message: 'Utilisateur supprimé avec succès', licence: await tenant.licenseInfo() });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

module.exports = { getAllUsers, getLicenses, createUser, updateUser, resetUserPassword, deleteUser };
