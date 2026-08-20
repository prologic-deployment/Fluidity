const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { Utilisateur } = require('../models/user.model');
const { sendResetPasswordEmail } = require('../services/email.service');
const { supprimerFichierUpload } = require('../utils/upload-file.util');
const { enregistrerActivite } = require('../utils/login-activity.util');

/**
 * Inscription d'un nouvel utilisateur.
 */
const register = async (req, res) => {
  try {
    const { email, password, role } = req.body;

    const existing = await Utilisateur.findOne({ email });
    if (existing) {
      res.status(409).json({ message: 'Cet email est déjà utilisé' });
      return;
    }

    const user = new Utilisateur({
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
 * Émet la session complète (JWT + profil) — facteur commun de la connexion
 * classique et de la validation du second facteur (2FA).
 */
const issueSession = (res, user, extras = {}, contexte = {}) => {
  const secret = process.env.JWT_SECRET;
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  const token = jwt.sign(
    {
      userId: user._id,
      role: user.role,
      email: user.email,
    },
    secret,
    { expiresIn }
  );

  if (contexte.req) {
    enregistrerActivite(contexte.req, {
      userId: user._id,
      principalType: 'UTILISATEUR',
      succes: true,
      mfaUtilise: !!contexte.mfaUtilise,
      sessionIat: jwt.decode(token)?.iat || null,
    });
  }

  res.status(200).json({
    token,
    userId: user._id,
    role: user.role,
    email: user.email,
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    avatarUrl: user.avatarUrl || null,
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

    const user = await Utilisateur.findOne({ email }).select('+twoFactorSecret +twoFactorBackupCodes');
    if (!user) {
      res.status(401).json({ message: 'Identifiants invalides' });
      return;
    }

    const valid = await user.comparePassword(password);
    if (!valid) {
      enregistrerActivite(req, {
        userId: user._id,
        principalType: 'UTILISATEUR',
        succes: false,
        raisonEchec: 'MOT_DE_PASSE_INVALIDE',
      });
      res.status(401).json({ message: 'Identifiants invalides' });
      return;
    }

    if (user.twoFactorEnabled && user.twoFactorVerified) {
      res.status(200).json({
        requiresTwoFactor: true,
        twoFactorToken: signTwoFactorToken(user._id),
        expiresInMinutes: 5,
      });
      return;
    }

    issueSession(res, user, {}, { req });
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
 * Renvoie le profil de l'utilisateur authentifié (sans données sensibles).
 */
const me = async (req, res) => {
  try {
    const user = await Utilisateur.findOne({ _id: req.userId }).select(
      '-password -resetToken -resetTokenExpiry -twoFactorSecret -twoFactorBackupCodes'
    );

    if (!user) {
      res.status(404).json({ message: 'Utilisateur introuvable' });
      return;
    }
    res.status(200).json(user);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

/**
 * Mise à jour de SON propre profil (PATCH /api/auth/profile).
 * Liste blanche appliquée par le schéma zod : email, rôle et champs 2FA ne
 * peuvent pas être modifiés par cette route.
 */
const updateProfile = async (req, res) => {
  try {
    const user = await Utilisateur.findById(req.userId);
    if (!user) {
      res.status(404).json({ message: 'Utilisateur introuvable' });
      return;
    }

    const ancienAvatar = user.avatarUrl;
    const champs = ['firstName', 'lastName', 'phone', 'jobTitle', 'bio', 'address', 'avatarUrl'];
    for (const champ of champs) {
      if (req.body[champ] !== undefined) user[champ] = req.body[champ];
    }
    await user.save();

    // Photo remplacée ou supprimée : supprimer l'ancien fichier (best-effort)
    if (req.body.avatarUrl !== undefined && ancienAvatar && ancienAvatar !== user.avatarUrl) {
      supprimerFichierUpload(ancienAvatar);
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

/**
 * Journal de connexion DU COMPTE COURANT (un utilisateur ne voit que sa
 * propre activité) — le plus récent d'abord, paginé.
 */
const loginActivity = async (req, res) => {
  try {
    const { LoginActivity } = require('../models/login-activity.model');
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const filtre = { principalType: 'UTILISATEUR', userId: req.userId };

    const [total, activites] = await Promise.all([
      LoginActivity.countDocuments(filtre),
      LoginActivity.find(filtre)
        .sort({ date: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select('-userAgent -__v')
        .lean(),
    ]);

    res.status(200).json({
      activites,
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
      sessionIatActuel: req.tokenIat || null,
    });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

module.exports = {
  register,
  login,
  loginActivity,
  forgotPassword,
  resetPassword,
  me,
  updateProfile,
  changePassword,
  // Réutilisés par le contrôleur 2FA
  issueSession,
  signTwoFactorToken,
  verifyTwoFactorToken,
};
