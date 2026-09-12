const { rateLimit } = require('express-rate-limit');

/**
 * AUTH-004 (audit) : limitation de débit sur les surfaces d'authentification.
 *
 * - Login            : 10 tentatives / 15 min / IP+compte (credential stuffing)
 * - 2FA verify-login : 6 essais / 5 min / IP+compte (brute-force OTP 6 chiffres)
 * - Forgot-password  : 3 requêtes / heure / IP (mail bombing)
 * - Reset-password   : 6 requêtes / heure / IP
 * - Change-password  : 12 requêtes / heure / IP+compte
 * - 2FA setup/disable: 12 requêtes / heure / IP+compte
 * - API générale     : filet anti-abus 600 req / 5 min / IP
 *
 * Les réponses 429 portent « Retry-After » (en-têtes standard draft-7).
 * Un verrouillage de compte côté DB (loginAttempts/lockedUntil) complète le
 * dispositif — voir auth.controller (soft lockout avec backoff).
 */

const EMAIL_DU_BODY = (req) => {
  const email = String((req.body && (req.body.email || req.body.account)) || '').toLowerCase().trim();
  return email || '';
};

const keyIp = (req) => req.ip || 'unknown';
const keyIpCompte = (req) => `${req.ip || 'unknown'}|${EMAIL_DU_BODY(req)}`;

const handler429 = (message) => (req, res) => {
  res.status(429).json({ code: 'TROP_DE_REQUETES', message });
};

// NB : le verrouillage de compte (8 échecs ⇒ 15 min, auth.controller) est la
// défense par COMPTE ; ce limiteur est la défense par IP+compte contre le
// credential stuffing distribué (20 tentatives / 15 min par IP+email).
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: keyIpCompte,
  handler: handler429('Trop de tentatives de connexion. Réessayez dans quelques minutes.'),
});

const twoFactorLoginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 15,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: keyIpCompte,
  handler: handler429('Trop de codes 2FA tentés. Un nouveau code de connexion est requis.'),
});

const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 3,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: keyIp,
  handler: handler429('Trop de demandes de réinitialisation. Réessayez plus tard.'),
});

const resetPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 6,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: keyIp,
  handler: handler429('Trop de tentatives de réinitialisation. Réessayez plus tard.'),
});

const changePasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 12,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: keyIpCompte,
  handler: handler429('Trop de changements de mot de passe. Réessayez plus tard.'),
});

const twoFactorSetupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 12,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => `${req.ip || 'unknown'}|${req.userId || ''}`,
  handler: handler429('Trop d’opérations 2FA. Réessayez plus tard.'),
});

// Filet global : protège toutes les routes API des abus grossiers.
const apiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 600,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: keyIp,
  handler: handler429('Trop de requêtes. Réessayez dans quelques minutes.'),
});

module.exports = {
  loginLimiter,
  twoFactorLoginLimiter,
  forgotPasswordLimiter,
  resetPasswordLimiter,
  changePasswordLimiter,
  twoFactorSetupLimiter,
  apiLimiter,
};
