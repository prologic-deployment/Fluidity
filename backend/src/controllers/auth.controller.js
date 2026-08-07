const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const { Utilisateur, ROLES } = require('../models/user.model');
const { Tenant } = require('../models/tenant.model');
const { sendResetPasswordEmail } = require('../services/email.service');
const { supprimerFichierUpload } = require('../utils/upload-file.util');

/** Message d'aide quand le compte provient de données pré-multi-tenant. */
const LEGACY_MESSAGE =
  'Ce compte provient d’une ancienne version des données (identifiants hérités, rôles obsolètes). ' +
  'Exécutez « npm run migrate » côté backend pour convertir les données, puis reconnectez-vous.';

/** Marque renvoyée au frontend pour afficher le workspace (white-label). */
const tenantBranding = (tenant) =>
  tenant
    ? {
        _id: tenant._id,
        name: tenant.name,
        type: tenant.type,
        logoUrl: tenant.logoUrl,
        faviconUrl: tenant.faviconUrl,
        primaryColor: tenant.primaryColor,
        secondaryColor: tenant.secondaryColor,
        plan: tenant.plan,
        timezone: tenant.timezone,
        language: tenant.language,
      }
    : null;

/**
 * Inscription d'un nouvel utilisateur (rattachement à un tenant existant).
 * Réservée aux flux d'intégration ; la création d'utilisateurs se fait
 * normalement via /api/users (Tenant Admin) ou /api/tenants (Super Admin).
 */
const register = async (req, res) => {
  try {
    const { tenantId, email, password, role } = req.body;

    const tenant = await Tenant.findOne({ _id: tenantId, status: 'active' });
    if (!tenant) {
      res.status(400).json({ message: 'Tenant invalide ou inactif' });
      return;
    }

    const existing = await Utilisateur.findOne({ email });
    if (existing) {
      res.status(409).json({ message: 'Cet email est déjà utilisé' });
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
 * Émet la session complète (JWT + profil + marque tenant) — facteur commun de
 * la connexion classique et de la validation du second facteur (2FA), pour ne
 * pas dupliquer la logique d'émission.
 */
const issueSession = (res, user, tenant, extras = {}) => {
  const secret = process.env.JWT_SECRET;
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  const token = jwt.sign(
    { tenantId: user.tenantId || null, userId: user._id, role: user.role, email: user.email },
    secret,
    { expiresIn }
  );

  res.status(200).json({
    token,
    userId: user._id,
    tenantId: user.tenantId || null,
    role: user.role,
    email: user.email,
    status: user.status,
    // Identité d'affichage (topbar, sidebar, menu profil) — jamais de secret
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    avatarUrl: user.avatarUrl || null,
    tenant: tenantBranding(tenant),
    ...extras,
  });
};

/**
 * Jeton temporaire « second facteur » (5 min) : preuve que le mot de passe
 * est correct, en attente du code OTP. Ne sert JAMAIS de session.
 */
const TWO_FACTOR_PURPOSE = '2fa-login';
const signTwoFactorToken = (userId) =>
  jwt.sign({ purpose: TWO_FACTOR_PURPOSE, userId }, process.env.JWT_SECRET, { expiresIn: '5m' });

const verifyTwoFactorToken = (token) => {
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  if (decoded?.purpose !== TWO_FACTOR_PURPOSE) throw new Error('Jeton 2FA invalide');
  return decoded.userId;
};

/**
 * Connexion : vérifie les identifiants puis —
 *   - compte SANS 2FA : session JWT classique ;
 *   - compte AVEC 2FA : jeton temporaire (5 min), la session n'est émise
 *     qu'après POST /api/auth/2fa/verify-login avec un code OTP valide.
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await Utilisateur.findOne({ email });
    if (!user) {
      res.status(401).json({ message: 'Identifiants invalides' });
      return;
    }

    const valid = await user.comparePassword(password);
    if (!valid) {
      res.status(401).json({ message: 'Identifiants invalides' });
      return;
    }

    if (user.status === 'suspended' && user.role !== 'PLATFORM_ADMIN') {
      res.status(403).json({ message: 'Ce compte est suspendu. Contactez votre administrateur.' });
      return;
    }

    // Compte issu de données pré-multi-tenant (rôle obsolète ou tenantId
    // texte) : guider explicitement vers `npm run migrate` plutôt qu'une
    // erreur 500 illisible (CastError) — cause fréquente de « connexion impossible ».
    if (!ROLES.includes(user.role) || (user.tenantId && !mongoose.isValidObjectId(user.tenantId))) {
      res.status(403).json({ message: LEGACY_MESSAGE });
      return;
    }

    // Marque du workspace + blocage si le tenant est suspendu
    let tenant = null;
    if (user.tenantId) {
      tenant = await Tenant.findById(user.tenantId);
      if (!tenant || tenant.status === 'terminated') {
        res.status(403).json({ message: 'Cet espace de travail n\'existe plus.' });
        return;
      }
      if (tenant.status === 'suspended' && user.role !== 'PLATFORM_ADMIN') {
        res.status(403).json({
          message: 'Cet espace de travail est suspendu. Contactez le support de la plateforme.',
        });
        return;
      }
    }

    // Double authentification activée : le mot de passe est prouvé, mais la
    // session attend le code OTP — jeton temporaire à usage unique (5 min).
    if (user.twoFactorEnabled && user.twoFactorVerified) {
      res.status(200).json({
        requiresTwoFactor: true,
        twoFactorToken: signTwoFactorToken(user._id),
        expiresInMinutes: 5,
      });
      return;
    }

    issueSession(res, user, tenant);
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

    const user = await Utilisateur.findOne({ email });
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

    // Envoi asynchrone (ne bloque pas la réponse HTTP)
    sendResetPasswordEmail(email, token).catch(console.error);

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
 * Renvoie le profil de l'utilisateur authentifié (+ sa marque de tenant),
 * sans données sensibles. Utilisé par le frontend au rechargement.
 */
const me = async (req, res) => {
  try {
    const filter = { _id: req.userId };
    if (req.tenantId) filter.tenantId = req.tenantId;
    const user = await Utilisateur.findOne(filter).select('-password -resetToken -resetTokenExpiry');

    if (!user) {
      res.status(404).json({ message: 'Utilisateur introuvable' });
      return;
    }
    res.status(200).json({ user, tenant: tenantBranding(req.tenant || null) });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

/**
 * Mise à jour de SON propre profil (PATCH /api/auth/profile).
 * Liste blanche appliquée par le schéma zod : email, rôle, statut, tenant et
 * champs 2FA ne peuvent pas être modifiés par cette route.
 */
const updateProfile = async (req, res) => {
  try {
    const user = await Utilisateur.findById(req.userId);
    if (!user) {
      res.status(404).json({ message: 'Utilisateur introuvable' });
      return;
    }

    const ancienAvatar = user.avatarUrl;
    const champs = ['firstName', 'lastName', 'phone', 'jobTitle', 'bio', 'address', 'avatarUrl', 'timezone', 'language'];
    for (const champ of champs) {
      if (req.body[champ] !== undefined) user[champ] = req.body[champ];
    }
    await user.save();

    // Photo remplacée ou supprimée : supprimer l'ancien fichier pour éviter
    // d'accumuler des orphelins sur le disque (best-effort, jamais bloquant)
    if (req.body.avatarUrl !== undefined && ancienAvatar && ancienAvatar !== user.avatarUrl) {
      supprimerFichierUpload(ancienAvatar, req.tenantId);
    }

    const clean = await Utilisateur.findById(user._id).select(
      '-password -resetToken -resetTokenExpiry -twoFactorSecret -twoFactorBackupCodes'
    );
    res.status(200).json({ message: 'Profil mis à jour', user: clean });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

/**
 * Changement de SON mot de passe (connecté) : exige le mot de passe actuel.
 * Le hashage est assuré par le hook pre-save du modèle.
 */
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await Utilisateur.findById(req.userId);
    if (!user) {
      res.status(404).json({ message: 'Utilisateur introuvable' });
      return;
    }

    const valid = await user.comparePassword(currentPassword);
    if (!valid) {
      res.status(401).json({ message: 'Mot de passe actuel incorrect' });
      return;
    }
    if (currentPassword === newPassword) {
      res.status(400).json({ message: 'Le nouveau mot de passe doit être différent de l’actuel' });
      return;
    }

    user.password = newPassword; // hashé via le hook pre-save
    await user.save();

    res.status(200).json({ message: 'Mot de passe modifié avec succès' });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

module.exports = {
  register,
  login,
  forgotPassword,
  resetPassword,
  me,
  updateProfile,
  changePassword,
  // Réutilisés par le contrôleur 2FA (pas de logique d'émission dupliquée)
  issueSession,
  signTwoFactorToken,
  verifyTwoFactorToken,
};
