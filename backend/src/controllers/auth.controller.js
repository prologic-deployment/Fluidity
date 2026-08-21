const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { Utilisateur } = require('../models/user.model');
const { Client } = require('../models/client.model');
const { sendResetPasswordEmail } = require('../services/email.service');
const { supprimerFichierUpload } = require('../utils/upload-file.util');
const { enregistrerActivite } = require('../utils/login-activity.util');
const { PRINCIPAL_UTILISATEUR, PRINCIPAL_CLIENT, ROLE_PORTAIL } = require('../utils/principals');

/**
 * Inscription d'un nouvel utilisateur INTERNE.
 * (La création de comptes clients passe par /api/clients — ADMIN.)
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
      role: role || 'SUPPORT_N1',
    });
    await user.save();

    res.status(201).json({ message: 'Utilisateur créé avec succès', userId: user._id });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

/**
 * Émet la session complète (JWT + profil) — facteur commun de la connexion
 * classique et de la validation du second facteur (2FA), pour les deux types
 * de principals (Utilisateur interne / Client portail).
 */
const issueSession = (res, account, extras = {}, contexte = {}) => {
  const estClient = contexte.principalType === PRINCIPAL_CLIENT;
  const role = estClient ? ROLE_PORTAIL : account.role;

  const secret = process.env.JWT_SECRET;
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  const token = jwt.sign(
    {
      userId: account._id,
      role,
      email: account.email,
      principal: estClient ? PRINCIPAL_CLIENT : PRINCIPAL_UTILISATEUR,
    },
    secret,
    { expiresIn }
  );

  if (contexte.req) {
    enregistrerActivite(contexte.req, {
      userId: account._id,
      principalType: estClient ? PRINCIPAL_CLIENT : PRINCIPAL_UTILISATEUR,
      succes: true,
      mfaUtilise: !!contexte.mfaUtilise,
      sessionIat: jwt.decode(token)?.iat || null,
    });
  }

  res.status(200).json({
    token,
    userId: account._id,
    role,
    principalType: estClient ? PRINCIPAL_CLIENT : PRINCIPAL_UTILISATEUR,
    email: account.email,
    firstName: account.firstName || '',
    lastName: account.lastName || '',
    displayName: estClient ? account.nom : undefined,
    avatarUrl: account.avatarUrl || null,
    // Accès provisionné : changement obligatoire à la 1re connexion (client)
    mustChangePassword: estClient ? !!account.mustChangePassword : false,
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
 * Connexion d'un accès PORTAIL CLIENT (l'entité commerciale porte son
 * identité — plus aucun Utilisateur role='CLIENT').
 * @returns {Promise<boolean>} true si la réponse a été écrite.
 */
const loginClient = async (req, res, email, password) => {
  const client = await Client.findOne({ email }).select('+password +twoFactorSecret +twoFactorBackupCodes');
  if (!client || !client.password) return false;

  if (!(await client.comparePassword(password))) {
    enregistrerActivite(req, {
      userId: client._id, principalType: PRINCIPAL_CLIENT,
      succes: false, raisonEchec: 'MOT_DE_PASSE_INVALIDE',
    });
    res.status(401).json({ message: 'Identifiants invalides' });
    return true;
  }

  if (client.statut !== 'Actif') {
    enregistrerActivite(req, {
      userId: client._id, principalType: PRINCIPAL_CLIENT,
      succes: false, raisonEchec: 'COMPTE_INACTIF',
    });
    res.status(403).json({ message: 'Ce compte est inactif. Contactez votre administrateur.' });
    return true;
  }

  if (client.twoFactorEnabled && client.twoFactorVerified) {
    res.status(200).json({
      requiresTwoFactor: true,
      twoFactorToken: signTwoFactorToken(client._id),
      expiresInMinutes: 5,
    });
    return true;
  }

  issueSession(res, client, {}, { req, principalType: PRINCIPAL_CLIENT });
  return true;
};

/**
 * Connexion : vérifie les identifiants puis —
 *   - compte SANS 2FA : session JWT classique ;
 *   - compte AVEC 2FA : jeton temporaire (5 min), la session n'est émise
 *     qu'après POST /api/auth/2fa/verify-login avec un code OTP valide.
 * Résout d'abord un Utilisateur interne, puis un accès Client portail.
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await Utilisateur.findOne({ email }).select('+twoFactorSecret +twoFactorBackupCodes');
    if (!user) {
      if (await loginClient(req, res, email, password)) return;
      res.status(401).json({ message: 'Identifiants invalides' });
      return;
    }

    const valid = await user.comparePassword(password);
    if (!valid) {
      enregistrerActivite(req, {
        userId: user._id, principalType: PRINCIPAL_UTILISATEUR,
        succes: false, raisonEchec: 'MOT_DE_PASSE_INVALIDE',
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
 * Mot de passe oublié : génère un token UUID (valable 1h) et envoie un email.
 * Recherche parmi les Utilisateurs internes ET les Clients portail.
 */
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await Utilisateur.findOne({ email });
    const client = await Client.findOne({ email }).select('+password');

    if (!user && !client) {
      res.status(200).json({ message: "Si l'email existe, un lien de réinitialisation a été envoyé" });
      return;
    }

    const token = uuidv4();
    const account = user || client;
    account.resetToken = token;
    account.resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 heure
    await account.save();

    sendResetPasswordEmail(email, token).catch(console.error);

    res.status(200).json({ message: "Si l'email existe, un lien de réinitialisation a été envoyé" });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

/**
 * Réinitialisation effective du mot de passe à partir d'un token valide.
 * Recherche parmi les Utilisateurs internes ET les Clients portail.
 */
const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    const user = await Utilisateur.findOne({ resetToken: token, resetTokenExpiry: { $gt: new Date() } });
    const client = await Client.findOne({ resetToken: token, resetTokenExpiry: { $gt: new Date() } }).select('+password');

    if (!user && !client) {
      res.status(400).json({ message: 'Token invalide ou expiré' });
      return;
    }

    const account = user || client;
    account.password = password; // hashé via le hook pre-save
    account.resetToken = undefined;
    account.resetTokenExpiry = undefined;
    if (client) account.mustChangePassword = false;
    await account.save();

    res.status(200).json({ message: 'Mot de passe réinitialisé avec succès' });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

/**
 * Renvoie le profil de l'utilisateur authentifié (sans données sensibles).
 * Supporte les deux types de principals (Utilisateur / Client).
 */
const me = async (req, res) => {
  try {
    if (req.principalType === PRINCIPAL_CLIENT) {
      const client = await Client.findById(req.userId).select(
        '-password -resetToken -resetTokenExpiry -twoFactorSecret -twoFactorBackupCodes'
      );
      if (!client) {
        res.status(404).json({ message: 'Client introuvable' });
        return;
      }
      res.status(200).json({
        ...client.toObject(),
        role: ROLE_PORTAIL,
        principalType: PRINCIPAL_CLIENT,
        mustChangePassword: !!client.mustChangePassword,
      });
      return;
    }

    const user = await Utilisateur.findById(req.userId).select(
      '-password -resetToken -resetTokenExpiry -twoFactorSecret -twoFactorBackupCodes'
    );
    if (!user) {
      res.status(404).json({ message: 'Utilisateur introuvable' });
      return;
    }
    res.status(200).json({ ...user.toObject(), principalType: PRINCIPAL_UTILISATEUR });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

/**
 * Mise à jour de SON propre profil (PATCH /api/auth/profile).
 * Supporte Utilisateur et Client (liste blanche stricte côté schéma).
 */
const updateProfile = async (req, res) => {
  try {
    if (req.principalType === PRINCIPAL_CLIENT) {
      const client = await Client.findById(req.userId);
      if (!client) {
        res.status(404).json({ message: 'Client introuvable' });
        return;
      }
      const ancienAvatar = client.avatarUrl;
      const champs = ['firstName', 'lastName', 'bio', 'avatarUrl'];
      for (const champ of champs) {
        if (req.body[champ] !== undefined) client[champ] = req.body[champ];
      }
      await client.save();
      if (req.body.avatarUrl !== undefined && ancienAvatar && ancienAvatar !== client.avatarUrl) {
        supprimerFichierUpload(ancienAvatar);
      }
      const clean = await Client.findById(client._id).select(
        '-password -resetToken -resetTokenExpiry -twoFactorSecret -twoFactorBackupCodes'
      );
      res.status(200).json({
        message: 'Profil mis à jour',
        user: { ...clean.toObject(), role: ROLE_PORTAIL, principalType: PRINCIPAL_CLIENT },
      });
      return;
    }

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
 * Pour un Client, lève l'obligation de changement (mustChangePassword=false).
 */
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (req.principalType === PRINCIPAL_CLIENT) {
      const client = await Client.findById(req.userId).select('+password');
      if (!client) {
        res.status(404).json({ message: 'Client introuvable' });
        return;
      }
      const valide = await client.comparePassword(currentPassword);
      if (!valide) {
        res.status(401).json({ message: 'Mot de passe actuel incorrect' });
        return;
      }
      if (currentPassword === newPassword) {
        res.status(400).json({ message: 'Le nouveau mot de passe doit être différent de l’actuel' });
        return;
      }
      client.password = newPassword; // hashé via le hook pre-save
      client.mustChangePassword = false;
      await client.save();
      res.status(200).json({ message: 'Mot de passe modifié avec succès', mustChangePassword: false });
      return;
    }

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
 * Journal de connexion DU COMPTE COURANT (soi-même uniquement), paginé.
 * Supporte les deux types de principals.
 */
const loginActivity = async (req, res) => {
  try {
    const { LoginActivity } = require('../models/login-activity.model');
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const filtre = { principalType: req.principalType || PRINCIPAL_UTILISATEUR, userId: req.userId };

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
