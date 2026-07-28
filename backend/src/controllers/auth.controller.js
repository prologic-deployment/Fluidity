const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const mongoose = require('mongoose');
const { Utilisateur } = require('../models/user.model');
const { Tenant } = require('../models/tenant.model');
const { sendResetPasswordEmail } = require('../services/email.service');

/** Sélection de champs de branding renvoyés au frontend (login / me). */
const TENANT_PUBLIC_FIELDS = 'name slug type logoUrl faviconUrl primaryColor secondaryColor plan status maxUsers';

/**
 * Inscription d'un nouvel utilisateur, rattaché à un Tenant existant.
 * - Vérifie que le Tenant existe et n'est pas suspendu/résilié.
 * - Applique la limite de licences (Tenant.maxUsers) — voir "LICENSE MANAGEMENT" :
 *   un Tenant Admin ne peut jamais dépasser le nombre de licences achetées.
 */
const register = async (req, res) => {
  try {
    const { tenantId, email, password, role } = req.body;

    if (!mongoose.isValidObjectId(tenantId)) {
      res.status(400).json({ message: 'tenantId invalide' });
      return;
    }

    const tenant = await Tenant.findById(tenantId);
    if (!tenant) {
      res.status(404).json({ message: 'Tenant introuvable' });
      return;
    }
    if (['Suspended', 'Cancelled'].includes(tenant.status)) {
      res.status(403).json({ message: `Ce tenant est ${tenant.status === 'Suspended' ? 'suspendu' : 'résilié'} : impossible de créer un utilisateur.` });
      return;
    }

    const existing = await Utilisateur.findOne({ email });
    if (existing) {
      res.status(409).json({ message: 'Cet email est déjà utilisé' });
      return;
    }

    // Application de la limite de licences (nombre d'utilisateurs actifs du tenant)
    const activeUsers = await Utilisateur.countDocuments({ tenantId, statut: 'Actif' });
    if (activeUsers >= tenant.maxUsers) {
      res.status(403).json({
        message: `Limite de licences atteinte (${activeUsers}/${tenant.maxUsers}). Contactez votre administrateur pour augmenter le nombre de licences.`,
      });
      return;
    }

    const user = new Utilisateur({
      tenantId,
      email,
      password,
      role: role || 'CLIENT',
    });
    await user.save();

    res.status(201).json({ message: 'Utilisateur créé avec succès', userId: user._id });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

/**
 * Connexion : vérifie les identifiants et renvoie un JWT contenant
 * tenantId + userId + role, ainsi que les informations de marque du
 * Tenant (nom, logo, couleurs) pour un affichage white-label immédiat
 * côté frontend, sans requête supplémentaire.
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await Utilisateur.findOne({ email }).populate('tenantId', TENANT_PUBLIC_FIELDS);
    if (!user) {
      res.status(401).json({ message: 'Identifiants invalides' });
      return;
    }

    const valid = await user.comparePassword(password);
    if (!valid) {
      res.status(401).json({ message: 'Identifiants invalides' });
      return;
    }

    if (user.statut === 'Suspendu') {
      res.status(403).json({ message: 'Ce compte a été suspendu. Contactez votre administrateur.' });
      return;
    }

    const tenant = user.tenantId; // peuplé par populate()
    if (user.role !== 'SUPER_ADMIN' && tenant && ['Suspended', 'Cancelled'].includes(tenant.status)) {
      res.status(403).json({
        message: `L'espace de travail est ${tenant.status === 'Suspended' ? 'suspendu' : 'résilié'}. Contactez le support.`,
      });
      return;
    }

    const secret = process.env.JWT_SECRET;
    const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
    const tenantId = tenant?._id?.toString();
    const token = jwt.sign({ tenantId, userId: user._id, role: user.role, email: user.email }, secret, { expiresIn });

    const activeUsers = tenant ? await Utilisateur.countDocuments({ tenantId: tenant._id, statut: 'Actif' }) : undefined;

    res.status(200).json({
      token,
      userId: user._id,
      tenantId,
      role: user.role,
      email: user.email,
      tenant: tenant
        ? {
            id: tenant._id,
            name: tenant.name,
            slug: tenant.slug,
            type: tenant.type,
            logoUrl: tenant.logoUrl,
            faviconUrl: tenant.faviconUrl,
            primaryColor: tenant.primaryColor,
            secondaryColor: tenant.secondaryColor,
            plan: tenant.plan,
            status: tenant.status,
            maxUsers: tenant.maxUsers,
            activeUsers,
          }
        : null,
    });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

/**
 * Mot de passe oublié : génère un token UUID (valable 1h) et envoie
 * un email de réinitialisation de façon asynchrone.
 */
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await Utilisateur.findOne({ email }).populate('tenantId', 'name logoUrl primaryColor secondaryColor');
    // Réponse neutre pour ne pas révéler l'existence de l'email
    if (!user) {
      res.status(200).json({
        message: "Si l'email existe, un lien de réinitialisation a été envoyé",
      });
      return;
    }

    const token = uuidv4();
    user.resetToken = token;
    user.resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 heure
    await user.save();

    // Envoi asynchrone (ne bloque pas la réponse HTTP), à la marque du Tenant
    sendResetPasswordEmail(email, token, user.tenantId).catch(console.error);

    res.status(200).json({
      message: "Si l'email existe, un lien de réinitialisation a été envoyé",
    });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

/**
 * Réinitialisation effective du mot de passe à partir d'un token valide.
 */
const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    const user = await Utilisateur.findOne({
      resetToken: token,
      resetTokenExpiry: { $gt: new Date() },
    });
    if (!user) {
      res.status(400).json({ message: 'Token invalide ou expiré' });
      return;
    }

    user.password = password; // hashé via le hook pre-save
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
    await user.save();

    res.status(200).json({ message: 'Mot de passe réinitialisé avec succès' });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

/**
 * Renvoie le profil de l'utilisateur authentifié (sans données sensibles),
 * avec les informations de marque de son Tenant.
 */
const me = async (req, res) => {
  try {
    const user = await Utilisateur.findOne({
      _id: req.userId,
      tenantId: req.tenantId,
    })
      .select('-password -resetToken -resetTokenExpiry')
      .populate('tenantId', TENANT_PUBLIC_FIELDS);

    if (!user) {
      res.status(404).json({ message: 'Utilisateur introuvable' });
      return;
    }
    res.status(200).json(user);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

module.exports = { register, login, forgotPassword, resetPassword, me };
