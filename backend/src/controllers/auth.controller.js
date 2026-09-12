const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const { Utilisateur, ROLES } = require('../models/user.model');
const { Tenant } = require('../models/tenant.model');
const { sendResetPasswordEmail, sendPasswordChangedEmail } = require('../services/email.service');
const { supprimerFichierUpload } = require('../utils/upload-file.util');
const { enregistrerActivite } = require('../utils/login-activity.util');
const { Client } = require('../models/client.model');
const { PRINCIPAL_UTILISATEUR, PRINCIPAL_CLIENT, ROLE_PORTAIL } = require('../utils/principals');
const { apiError } = require('../utils/api-error');
const logger = require('../utils/logger.util');
// AUTH-008 (audit) : refus des mots de passe CHOISIS figurant dans des fuites
// connues (k-anonymité HaveIBeenPwned ; fail-open si le service est injoignable).
const { verifierFuite } = require('../utils/breach.util');
const {
  issueRefreshToken,
  rotateRefreshToken,
  resolveRefreshToken,
  reuseDetected,
  revokeCurrent,
  revokeAllForPrincipal,
  clearRefreshCookie,
} = require('../services/session.service');

/** Message d'aide quand le compte provient de données pré-multi-tenant. */
const LEGACY_MESSAGE =
  'Ce compte provient d’une ancienne version des données (identifiants hérités, rôles obsolètes). ' +
  'Exécutez « npm run migrate » côté backend pour convertir les données, puis reconnectez-vous.';

/** Empreinte SHA-256 (jetons de reset stockés hashés — CFG-002). */
const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');

// AUTH-004 (audit) : verrouillage DOUX par compte — 8 échecs ⇒ 15 minutes,
// compteur remis à zéro à la première connexion réussie. Complémentaire au
// rate-limit par IP (middleware) : un attaquant distribué reste bloqué ici.
const LOCK_MAX_ATTEMPTS = 8;
const LOCK_MINUTES = 15;

/** Secondes restantes de verrouillage (0 = non verrouillé). */
const lockSecondsLeft = (account) =>
  account?.lockedUntil && account.lockedUntil > new Date()
    ? Math.ceil((account.lockedUntil - Date.now()) / 1000)
    : 0;

/** Échec de connexion : incrémente le compteur, verrouille au seuil. */
async function registerLoginFailure(account) {
  if (!account) return;
  account.loginAttempts = (account.loginAttempts || 0) + 1;
  if (account.loginAttempts >= LOCK_MAX_ATTEMPTS) {
    account.lockedUntil = new Date(Date.now() + LOCK_MINUTES * 60 * 1000);
    account.loginAttempts = 0;
  }
  await account.save();
}

/** Connexion réussie : purge compteur + verrou. */
async function clearLoginFailures(account) {
  if (!account || (!account.loginAttempts && !account.lockedUntil)) return;
  account.loginAttempts = 0;
  account.lockedUntil = null;
  await account.save();
}

/** Réponse 429 standardisée pour compte verrouillé. */
function respondLocked(res, seconds) {
  res.setHeader('Retry-After', String(seconds));
  res.status(429).json({
    code: 'COMPTE_VERROUILLE',
    message: 'Trop de tentatives : compte temporairement verrouillé. Réessayez dans quelques minutes.',
  });
}

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

// AUTH-001 (audit) : l'inscription publique « register » a été supprimée.
// Elle acceptait un rôle TENANT_ADMIN sans authentification (escalade de
// privilèges), contournait la limite de sièges et toute vérification
// d'email. La création de comptes est réservée aux administrateurs :
//   POST /api/tenants (Super Admin), POST /api/users (Tenant Admin),
//   POST /api/clients (comptes portail). Voir docs/FLUIDITY_A4_REMEDIATION.md.

/**
 * Émet la session complète (JWT + profil + marque tenant) — facteur commun de
 * la connexion classique et de la validation du second facteur (2FA), pour ne
 * pas dupliquer la logique d'émission.
 */
const issueSession = async (res, user, tenant, extras = {}, contexte = {}) => {
  // Deux types de principals (utils/principals) : UTILISATEUR (compte interne,
  // rôle RBAC) ou CLIENT (accès portail de l'entité commerciale — rôle effectif
  // ROLE_PORTAIL dans le jeton, jamais un rôle Utilisateur).
  const estClient = contexte.principalType === PRINCIPAL_CLIENT;
  const role = estClient ? ROLE_PORTAIL : user.role;

  const secret = process.env.JWT_SECRET;
  // AUTH-003 (audit) : jeton d'accès COURTE DURÉE (15 min par défaut, était 7 j).
  // La session longue est portée par le jeton de rafraîchissement rotatif en
  // cookie httpOnly (session.service) ; JWT_EXPIRES_IN reste surchargeable.
  const expiresIn = process.env.JWT_EXPIRES_IN || '15m';
  const token = jwt.sign(
    {
      tenantId: user.tenantId || null,
      userId: user._id,
      role,
      email: user.email,
      principal: estClient ? PRINCIPAL_CLIENT : PRINCIPAL_UTILISATEUR,
      // Version de session : toute révocation (mot de passe, rôle, 2FA…)
      // incrémente le compteur DB et invalide les jetons antérieurs.
      tv: user.tokenVersion || 0,
    },
    secret,
    { expiresIn }
  );

  // Jeton de rafraîchissement rotatif (cookie httpOnly) — nouveau « family »
  // à chaque login / validation 2FA.
  if (contexte.req) {
    await issueRefreshToken(contexte.req, res, {
      userId: user._id,
      principalType: estClient ? PRINCIPAL_CLIENT : PRINCIPAL_UTILISATEUR,
      tenantId: user.tenantId || null,
    });
  }

  // contexte.silent : pas de journalisation « connexion » (ex. réémission de
  // session après changement de mot de passe — ce n'est pas un login).
  if (contexte.req && !contexte.silent) {
    enregistrerActivite(contexte.req, {
      userId: user._id,
      tenantId: user.tenantId || null,
      principalType: estClient ? PRINCIPAL_CLIENT : PRINCIPAL_UTILISATEUR,
      succes: true,
      mfaUtilise: !!contexte.mfaUtilise,
      sessionIat: jwt.decode(token)?.iat || null,
    });
  }

  res.status(200).json({
    token,
    // Expiration absolue du jeton d'accès (le frontend planifie le refresh).
    expiresAt: new Date((jwt.decode(token)?.exp || 0) * 1000).toISOString(),
    userId: user._id,
    tenantId: user.tenantId || null,
    role,
    principalType: estClient ? PRINCIPAL_CLIENT : PRINCIPAL_UTILISATEUR,
    email: user.email,
    status: estClient ? (user.statut === 'Actif' ? 'active' : 'inactive') : user.status,
    // Identité d'affichage (topbar, sidebar, menu profil) — jamais de secret
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    displayName: estClient ? user.nom : undefined,
    avatarUrl: user.avatarUrl || null,
    // Accès provisionné par l'admin : changement obligatoire à la 1re connexion
    mustChangePassword: estClient ? !!user.mustChangePassword : false,
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
 * Connexion d'un accès PORTAIL CLIENT (l'entité commerciale qui porte son
 * identité — plus aucun Utilisateur role='CLIENT').
 *
 * L'email d'un client n'est unique qu'AU SEIN d'un tenant : plusieurs
 * fiches de tenants différents peuvent partager le même email. On résout
 * l'ambiguïté par le mot de passe (les accès sont générés aléatoirement) —
 * exactement UNE fiche doit correspondre.
 *
 * @returns {Promise<boolean>} true si la réponse a été écrite (tentative
 *   attribuable à une fiche), false si aucune fiche ne porte cet email.
 */
const loginClient = async (req, res, email, password) => {
  const candidats = await Client.find({ email }).select(
    '+password +twoFactorSecret +twoFactorBackupCodes +loginAttempts +lockedUntil'
  );
  if (!candidats.length) return false;

  // AUTH-004 : si l'une des fiches portant cet email est verrouillée, la
  // tentative est refusée (l'ambiguïté multi-tenant interdit de deviner la cible).
  for (const fiche of candidats) {
    const left = lockSecondsLeft(fiche);
    if (left > 0) {
      respondLocked(res, left);
      return true;
    }
  }

  const correspondances = [];
  for (const fiche of candidats) {
    // eslint-disable-next-line no-await-in-loop
    if (await fiche.comparePassword(password)) correspondances.push(fiche);
  }
  if (correspondances.length === 0) {
    for (const fiche of candidats) {
      // eslint-disable-next-line no-await-in-loop
      await registerLoginFailure(fiche);
      enregistrerActivite(req, {
        userId: fiche._id, tenantId: fiche.tenantId, principalType: PRINCIPAL_CLIENT,
        succes: false, raisonEchec: 'MOT_DE_PASSE_INVALIDE',
      });
    }
    apiError(res, 401, 'INVALID_CREDENTIALS', 'Identifiants invalides');
    return true;
  }
  await clearLoginFailures(correspondances[0]);
  if (correspondances.length > 1) {
    // Quasi impossible (mots de passe aléatoires) — refus explicite plutôt
    // qu'une connexion sur le mauvais espace de travail.
    res.status(401).json({
      code: 'MULTIPLE_WORKSPACES',
      message: 'Cet identifiant est présent sur plusieurs espaces. Contactez votre administrateur pour sécuriser l’accès.',
    });
    return true;
  }

  const client = correspondances[0];
  if (client.statut !== 'Actif') {
    enregistrerActivite(req, {
      userId: client._id, tenantId: client.tenantId, principalType: PRINCIPAL_CLIENT,
      succes: false, raisonEchec: 'COMPTE_INACTIF',
    });
    apiError(res, 403, 'ACCOUNT_INACTIVE', 'Ce compte est inactif. Contactez votre administrateur.');
    return true;
  }

  const tenant = await Tenant.findById(client.tenantId);
  if (!tenant || tenant.status === 'terminated') {
    enregistrerActivite(req, {
      userId: client._id, tenantId: client.tenantId, principalType: PRINCIPAL_CLIENT,
      succes: false, raisonEchec: 'TENANT_INDISPONIBLE',
    });
    apiError(res, 403, 'TENANT_NOT_FOUND', "Cet espace de travail n'existe plus.");
    return true;
  }
  if (tenant.status === 'suspended') {
    enregistrerActivite(req, {
      userId: client._id, tenantId: client.tenantId, principalType: PRINCIPAL_CLIENT,
      succes: false, raisonEchec: 'TENANT_INDISPONIBLE',
    });
    res.status(403).json({
      code: 'TENANT_SUSPENDED',
      message: 'Cet espace de travail est suspendu. Contactez le support de la plateforme.',
    });
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

  await issueSession(res, client, tenant, {}, { req, principalType: PRINCIPAL_CLIENT });
  return true;
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

    const user = await Utilisateur.findOne({ email }).select('+loginAttempts +lockedUntil');
    if (!user) {
      // Aucun compte interne : la tentative peut viser un accès PORTAIL CLIENT
      // (l'entité commerciale porte sa propre identité depuis la refonte).
      if (await loginClient(req, res, email, password)) return;
      // Email inconnu des deux référentiels : non journalisé (non attribuable,
      // pas de canal d'énumération des emails par le journal).
      res.status(401).json({ message: 'Identifiants invalides' });
      return;
    }

    // AUTH-004 : compte verrouillé après échecs répétés (soft lockout).
    const lockLeft = lockSecondsLeft(user);
    if (lockLeft > 0) {
      enregistrerActivite(req, {
        userId: user._id, tenantId: user.tenantId || null,
        succes: false, raisonEchec: 'COMPTE_VERROUILLE',
      });
      respondLocked(res, lockLeft);
      return;
    }

    const valid = await user.comparePassword(password);
    if (!valid) {
      await registerLoginFailure(user);
      enregistrerActivite(req, {
        userId: user._id, tenantId: user.tenantId || null,
        succes: false, raisonEchec: 'MOT_DE_PASSE_INVALIDE',
      });
      res.status(401).json({ message: 'Identifiants invalides' });
      return;
    }
    await clearLoginFailures(user);

    if (user.status === 'suspended' && user.role !== 'PLATFORM_ADMIN') {
      enregistrerActivite(req, {
        userId: user._id, tenantId: user.tenantId || null,
        succes: false, raisonEchec: 'COMPTE_SUSPENDU',
      });
      apiError(res, 403, 'ACCOUNT_SUSPENDED', 'Ce compte est suspendu. Contactez votre administrateur.');
      return;
    }

    // CT-003 (audit) : un compte créé « invited » ne peut pas se connecter
    // tant qu'un administrateur ne l'a pas activé (statut → active).
    if (user.status === 'invited' && user.role !== 'PLATFORM_ADMIN') {
      enregistrerActivite(req, {
        userId: user._id, tenantId: user.tenantId || null,
        succes: false, raisonEchec: 'COMPTE_NON_ACTIVE',
      });
      apiError(res, 403, 'ACCOUNT_NOT_ACTIVATED', 'Ce compte n\'a pas encore été activé. Contactez votre administrateur.');
      return;
    }

    // Compte issu de données pré-multi-tenant (rôle obsolète ou tenantId
    // texte) : guider explicitement vers `npm run migrate` plutôt qu'une
    // erreur 500 illisible (CastError) — cause fréquente de « connexion impossible ».
    if (!ROLES.includes(user.role) || (user.tenantId && !mongoose.isValidObjectId(user.tenantId))) {
      enregistrerActivite(req, {
        userId: user._id, tenantId: null, succes: false, raisonEchec: 'DONNEES_HERITEES',
      });
      apiError(res, 403, 'LEGACY_DATA', LEGACY_MESSAGE);
      return;
    }

    // Marque du workspace + blocage si le tenant est suspendu
    let tenant = null;
    if (user.tenantId) {
      tenant = await Tenant.findById(user.tenantId);
      if (!tenant || tenant.status === 'terminated') {
        enregistrerActivite(req, {
          userId: user._id, tenantId: user.tenantId || null, succes: false, raisonEchec: 'TENANT_INDISPONIBLE',
        });
        res.status(403).json({ message: 'Cet espace de travail n\'existe plus.' });
        return;
      }
      if (tenant.status === 'suspended' && user.role !== 'PLATFORM_ADMIN') {
        enregistrerActivite(req, {
          userId: user._id, tenantId: user.tenantId || null, succes: false, raisonEchec: 'TENANT_INDISPONIBLE',
        });
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

    await issueSession(res, user, tenant, {}, { req });
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
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

    // CFG-002 (audit) : le jeton envoyé par email n'est JAMAIS stocké en clair ;
    // seule son empreinte SHA-256 est conservée (comparaison hashée au reset).
    const token = uuidv4();
    user.resetToken = sha256(token);
    user.resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 heure
    await user.save();

    // Envoi asynchrone (ne bloque pas la réponse HTTP)
    sendResetPasswordEmail(email, token).catch(console.error);

    res.status(200).json({
      message: "Si l'email existe, un lien de réinitialisation a été envoyé",
    });
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

/**
 * Réinitialisation effective du mot de passe à partir d'un token valide.
 */
const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    // CFG-002 : comparaison sur l'empreinte SHA-256 (le clair n'est jamais stocké).
    const user = await Utilisateur.findOne({
      resetToken: sha256(String(token || '')),
      resetTokenExpiry: { $gt: new Date() },
    }).select('+resetToken +resetTokenExpiry');
    if (!user) {
      apiError(res, 400, 'RESET_TOKEN_INVALID', 'Token invalide ou expiré');
      return;
    }

    // AUTH-008 : le mot de passe de réinitialisation ne doit pas être compromis.
    const fuiteReset = await verifierFuite(password);
    if (fuiteReset.compromis) {
      apiError(res, 400, 'PASSWORD_BREACHED', 'Ce mot de passe figure dans des fuites connues — choisissez-en un autre.');
      return;
    }

    user.password = password; // hashé via le hook pre-save
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
    // AUTH-003 : le reset révoque TOUTES les sessions existantes (mot de passe
    // compromis ⇒ les anciens jetons doivent mourir immédiatement).
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();
    await revokeAllForPrincipal(user._id, PRINCIPAL_UTILISATEUR);
    // MAIL-003 : confirmation de sécurité (réinitialisation du mot de passe).
    sendPasswordChangedEmail(user.email).catch(() => {});

    res.status(200).json({ message: 'Mot de passe réinitialisé avec succès' });
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

/**
 * Renvoie le profil de l'utilisateur authentifié (+ sa marque de tenant),
 * sans données sensibles. Utilisé par le frontend au rechargement.
 */
const me = async (req, res) => {
  try {
    // Principal CLIENT : la fiche commerciale EST le compte (aucune donnée
    // interne exposée ; principalType/mustChangePassword joints pour le shell).
    if (req.principalType === PRINCIPAL_CLIENT) {
      const client = await Client.findOne({ _id: req.userId, tenantId: req.tenantId }).lean();
      if (!client) {
        apiError(res, 404, 'CLIENT_NOT_FOUND', 'Client introuvable');
        return;
      }
      res.status(200).json({
        user: {
          _id: client._id,
          email: client.email,
          nom: client.nom,
          telephone: client.telephone,
          adresse: client.adresse,
          statut: client.statut,
          role: ROLE_PORTAIL,
          principalType: PRINCIPAL_CLIENT,
          mustChangePassword: !!client.mustChangePassword,
          createdAt: client.createdAt,
          updatedAt: client.updatedAt,
        },
        tenant: tenantBranding(req.tenant || null),
      });
      return;
    }

    const filter = { _id: req.userId };
    if (req.tenantId) filter.tenantId = req.tenantId;
    const user = await Utilisateur.findOne(filter).select('-password -resetToken -resetTokenExpiry');

    if (!user) {
      apiError(res, 404, 'USER_NOT_FOUND', 'Utilisateur introuvable');
      return;
    }
    res.status(200).json({
      user: { ...user.toObject(), principalType: PRINCIPAL_UTILISATEUR, mustChangePassword: false },
      tenant: tenantBranding(req.tenant || null),
    });
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

/**
 * Mise à jour de SON propre profil (PATCH /api/auth/profile).
 * Liste blanche appliquée par le schéma zod : email, rôle, statut, tenant et
 * champs 2FA ne peuvent pas être modifiés par cette route.
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
      if (req.body.firstName !== undefined) client.firstName = req.body.firstName;
      if (req.body.lastName !== undefined) client.lastName = req.body.lastName;
      if (req.body.phone !== undefined) client.telephone = req.body.phone;
      if (req.body.address !== undefined) client.adresse = req.body.address;
      if (req.body.avatarUrl !== undefined) client.avatarUrl = req.body.avatarUrl;
      await client.save();
      if (req.body.avatarUrl !== undefined && ancienAvatar && ancienAvatar !== client.avatarUrl) {
        supprimerFichierUpload(ancienAvatar, req.tenantId);
      }
      const clean = await Client.findById(client._id).select(
        '-password -resetToken -resetTokenExpiry -twoFactorSecret -twoFactorBackupCodes'
      );
      res.status(200).json({
        message: 'Profil mis à jour',
        user: {
          ...clean.toObject(),
          phone: clean.telephone,
          address: clean.adresse,
          role: ROLE_PORTAIL,
          principalType: PRINCIPAL_CLIENT,
          mustChangePassword: !!clean.mustChangePassword,
        },
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
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

/**
 * Changement de SON mot de passe (connecté) : exige le mot de passe actuel.
 * Le hashage est assuré par le hook pre-save du modèle.
 */
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // AUTH-008 : le nouveau mot de passe ne doit pas figurer dans des fuites.
    const fuiteChangement = await verifierFuite(newPassword);
    if (fuiteChangement.compromis) {
      apiError(res, 400, 'PASSWORD_BREACHED', 'Ce mot de passe figure dans des fuites connues — choisissez-en un autre.');
      return;
    }

    // Principal CLIENT : même preuve du mot de passe actuel (le provisoire),
    // puis lève l'obligation de changement (accès complet débloqué).
    if (req.principalType === PRINCIPAL_CLIENT) {
      const client = await Client.findById(req.userId).select('+password');
      if (!client) {
        res.status(404).json({ message: 'Client introuvable' });
        return;
      }
      const valideClient = await client.comparePassword(currentPassword);
      if (!valideClient) {
        apiError(res, 401, 'CURRENT_PASSWORD_INVALID', 'Mot de passe actuel incorrect');
        return;
      }
      if (currentPassword === newPassword) {
        apiError(res, 400, 'PASSWORD_SAME', 'Le nouveau mot de passe doit être différent de l’actuel');
        return;
      }
      client.password = newPassword; // hashé via le hook pre-save
      client.mustChangePassword = false;
      // AUTH-003 : le changement de mot de passe révoque toutes les sessions
      // antérieures (tokenVersion++ ⇒ anciens JWT rejetés, refresh tokens révoqués).
      // On réémet immédiatement une session fraîche pour la requête courante afin
      // que l'utilisateur qui vient de changer SON mot de passe reste connecté.
      client.tokenVersion = (client.tokenVersion || 0) + 1;
      await client.save();
      await revokeAllForPrincipal(client._id, PRINCIPAL_CLIENT);
      const tenantClient = await Tenant.findById(client.tenantId);
      await issueSession(res, client, tenantClient, { mustChangePassword: false }, { req, principalType: PRINCIPAL_CLIENT, silent: true });
      // MAIL-003 : confirmation de sécurité (changement de mot de passe).
      sendPasswordChangedEmail(client.email).catch(() => {});
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
    // AUTH-003 : révocation des sessions antérieures + session fraîche pour
    // l'utilisateur courant (voir chemin CLIENT ci-dessus).
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();
    await revokeAllForPrincipal(user._id, PRINCIPAL_UTILISATEUR);
    const tenantUser = user.tenantId ? await Tenant.findById(user.tenantId) : null;
    await issueSession(res, user, tenantUser, {}, { req, silent: true });
    // MAIL-003 : confirmation de sécurité (changement de mot de passe).
    sendPasswordChangedEmail(user.email).catch(() => {});
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

/**
 * Journal de connexion DU COMPTE COURANT (un utilisateur ne voit que sa
 * propre activité) — le plus récent d'abord, paginé.
 * `sessionIatActuel` permet au frontend de surligner la session en cours.
 */
const loginActivity = async (req, res) => {
  try {
    const { LoginActivity } = require('../models/login-activity.model');
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const filtre = { principalType: req.principalType || 'UTILISATEUR', userId: req.userId };

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
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

/**
 * AUTH-003 (audit) : rafraîchissement de session par jeton rotatif (cookie
 * httpOnly). Aucune donnée de session n'est acceptée hors cookie — la requête
 * n'a pas d'en-tête Authorization.
 *
 * Rotation : chaque usage révoque le jeton présenté et en émet un nouveau.
 * Réutilisation d'un jeton déjà remplacé ⇒ vol probable ⇒ révocation de toute
 * la famille + 401.
 */
const refreshSession = async (req, res) => {
  try {
    const doc = await resolveRefreshToken(req);
    if (!doc) {
      clearRefreshCookie(res);
      res.status(401).json({ code: 'SESSION_EXPIREE', message: 'Session expirée. Veuillez vous reconnecter.' });
      return;
    }
    // Jeton déjà remplacé présenté à nouveau = réutilisation frauduleuse.
    if (await reuseDetected(doc)) {
      clearRefreshCookie(res);
      res.status(401).json({ code: 'SESSION_REVOQUEE', message: 'Session révoquée par sécurité. Veuillez vous reconnecter.' });
      return;
    }
    if (doc.revokedAt || doc.expiresAt < new Date()) {
      clearRefreshCookie(res);
      res.status(401).json({ code: 'SESSION_EXPIREE', message: 'Session expirée. Veuillez vous reconnecter.' });
      return;
    }

    // Rotation AVANT de charger le principal (le jeton présenté est consommé
    // quoi qu'il arrive ensuite).
    await rotateRefreshToken(req, res, doc);

    // Rechargement complet du principal : le nouveau JWT reflète l'état DB
    // courant (rôle, statut, tokenVersion) — mêmes contrôles que authMiddleware.
    const estClient = doc.principalType === PRINCIPAL_CLIENT;
    const secret = process.env.JWT_SECRET;
    const expiresIn = process.env.JWT_EXPIRES_IN || '15m';

    if (estClient) {
      // NB : toute révocation de sécurité passe par revokeAllForPrincipal() qui
      // pose revokedAt sur les jetons — le test doc.revokedAt ci-dessus suffit.
      const client = await Client.findById(doc.userId).select('email tenantId statut tokenVersion').lean();
      if (!client || client.statut !== 'Actif') {
        clearRefreshCookie(res);
        res.status(401).json({ code: 'SESSION_REVOQUEE', message: 'Session révoquée. Veuillez vous reconnecter.' });
        return;
      }
      const token = jwt.sign(
        { tenantId: client.tenantId || null, userId: client._id, role: ROLE_PORTAIL, email: client.email, principal: PRINCIPAL_CLIENT, tv: client.tokenVersion || 0 },
        secret,
        { expiresIn }
      );
      res.status(200).json({ token, expiresAt: new Date((jwt.decode(token)?.exp || 0) * 1000).toISOString(), role: ROLE_PORTAIL, principalType: PRINCIPAL_CLIENT });
      return;
    }

    const user = await Utilisateur.findById(doc.userId).select('role status tenantId email tokenVersion').lean();
    if (!user || (user.status === 'suspended' && user.role !== 'PLATFORM_ADMIN') || !ROLES.includes(user.role)) {
      clearRefreshCookie(res);
      res.status(401).json({ code: 'SESSION_REVOQUEE', message: 'Session révoquée. Veuillez vous reconnecter.' });
      return;
    }
    if (user.tenantId && mongoose.isValidObjectId(user.tenantId)) {
      const tenant = await Tenant.findById(user.tenantId).lean();
      if (!tenant || (tenant.status !== 'active' && user.role !== 'PLATFORM_ADMIN')) {
        clearRefreshCookie(res);
        res.status(401).json({ code: 'SESSION_REVOQUEE', message: 'Espace de travail indisponible.' });
        return;
      }
    }
    const token = jwt.sign(
      { tenantId: user.tenantId || null, userId: user._id, role: user.role, email: user.email, principal: PRINCIPAL_UTILISATEUR, tv: user.tokenVersion || 0 },
      secret,
      { expiresIn }
    );
    res.status(200).json({ token, expiresAt: new Date((jwt.decode(token)?.exp || 0) * 1000).toISOString(), role: user.role, principalType: PRINCIPAL_UTILISATEUR });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

/**
 * Déconnexion serveur : révoque le jeton de rafraîchissement du cookie et
 * efface le cookie. Idempotent (204 même sans cookie).
 */
const logout = async (req, res) => {
  try {
    await revokeCurrent(req, res);
    res.status(204).send();
  } catch (err) {
    res.status(204).send();
  }
};

module.exports = {
  // AUTH-001 : « register » supprimé (inscription publique = escalade de privilèges).
  login,
  loginActivity,
  forgotPassword,
  resetPassword,
  me,
  updateProfile,
  changePassword,
  refreshSession,
  logout,
  // Réutilisés par le contrôleur 2FA (pas de logique d'émission dupliquée)
  issueSession,
  signTwoFactorToken,
  verifyTwoFactorToken,
};
