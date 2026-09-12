const { Router } = require('express');
const {
  login,
  forgotPassword,
  resetPassword,
  me,
  loginActivity,
  updateProfile,
  changePassword,
  refreshSession,
  logout,
} = require('../controllers/auth.controller');
const {
  getStatus,
  setup,
  verifySetup,
  disable,
  verifyLogin,
} = require('../controllers/twoFactor.controller');
const { authMiddleware } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validate.middleware');
const {
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  updateProfileSchema,
  changePasswordSchema,
} = require('../schemas/auth.schema');
const {
  twoFactorVerifySetupSchema,
  twoFactorDisableSchema,
  twoFactorVerifyLoginSchema,
} = require('../schemas/twoFactor.schema');
const {
  loginLimiter,
  twoFactorLoginLimiter,
  forgotPasswordLimiter,
  resetPasswordLimiter,
  changePasswordLimiter,
  twoFactorSetupLimiter,
} = require('../middlewares/rate-limit.middleware');

const router = Router();

// AUTH-001 (audit) : l'inscription publique a été SUPPRIMÉE — elle permettait
// de créer un TENANT_ADMIN sans authentification. La création de comptes passe
// exclusivement par :
//   - POST /api/tenants            (Super Admin : tenant + admin invité)
//   - POST /api/users              (Tenant Admin : utilisateurs du tenant)
//   - POST /api/clients (+ accès)  (Tenant Admin : comptes portail)
// AUTH-004 : toutes les surfaces sensibles sont limitées en débit.
router.post('/login', loginLimiter, validate(loginSchema), login);
router.post('/forgot-password', forgotPasswordLimiter, validate(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', resetPasswordLimiter, validate(resetPasswordSchema), resetPassword);
// AUTH-003 : rafraîchissement (cookie httpOnly rotatif) et déconnexion serveur.
router.post('/refresh', refreshSession);
router.post('/logout', logout);
router.get('/me', authMiddleware, me);
// Audit : journal de connexion du compte courant (soi-même uniquement)
router.get('/me/login-activity', authMiddleware, loginActivity);
// Profil : chaque utilisateur met à jour UNIQUEMENT le sien (liste blanche zod)
router.patch('/profile', authMiddleware, validate(updateProfileSchema), updateProfile);
// Sécurité : changement de mot de passe avec preuve du mot de passe actuel
router.post('/change-password', changePasswordLimiter, authMiddleware, validate(changePasswordSchema), changePassword);

// --- Double authentification (2FA) — tout compte authentifié gère SA propre 2FA ---
router.get('/2fa/status', authMiddleware, getStatus);
router.post('/2fa/setup', twoFactorSetupLimiter, authMiddleware, setup);
router.post('/2fa/verify-setup', twoFactorSetupLimiter, authMiddleware, validate(twoFactorVerifySetupSchema), verifySetup);
router.post('/2fa/disable', twoFactorSetupLimiter, authMiddleware, validate(twoFactorDisableSchema), disable);
// Second facteur de connexion : jeton temporaire + code OTP (public, sans session)
router.post('/2fa/verify-login', twoFactorLoginLimiter, validate(twoFactorVerifyLoginSchema), verifyLogin);

module.exports = router;
