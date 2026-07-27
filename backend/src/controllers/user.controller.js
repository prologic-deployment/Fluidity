const { Utilisateur } = require('../models/user.model');
const { Tenant } = require('../models/tenant.model');
const { sendResetPasswordEmail } = require('../services/email.service');
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

const SANS_SECRETS = '-password -resetToken -resetTokenExpiry';

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
        const users = await Utilisateur.find(filter).select(SANS_SECRETS).sort({ createdAt: -1 });
        res.status(200).json(users);
        return;
      }
      filter.tenantId = req.query.tenantId;
    } else {
      filter.tenantId = req.tenantId;
    }
    const users = await Utilisateur.find(filter).select(SANS_SECRETS).sort({ createdAt: -1 });
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
 */
const createUser = async (req, res) => {
  try {
    const tenant = await resolveTargetTenant(req, res);
    if (!tenant) return;

    const existing = await Utilisateur.findOne({ email: req.body.email });
    if (existing) {
      res.status(409).json({ message: 'Cet email est déjà utilisé' });
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
      role: req.body.role || 'CLIENT',
      department: req.body.department || '',
      status: 'active',
    });
    await user.save();

    const clean = await Utilisateur.findById(user._id).select(SANS_SECRETS);
    res.status(201).json({ user: clean, licence: await tenant.licenseInfo() });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

/**
 * Modifier un utilisateur du tenant (rôle, département, statut).
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

    const { role, department, status } = req.body;
    if (role !== undefined) user.role = role;
    if (department !== undefined) user.department = department;
    if (status !== undefined) user.status = status;
    await user.save();

    const clean = await Utilisateur.findById(user._id).select(SANS_SECRETS);
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
