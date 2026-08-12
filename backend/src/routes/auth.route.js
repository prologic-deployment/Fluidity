const { Router } = require('express');
const {
  register,
  login,
  forgotPassword,
  resetPassword,
  me,
  loginActivity,
  updateProfile,
  changePassword,
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
  registerSchema,
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

const router = Router();

router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.post('/forgot-password', validate(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', validate(resetPasswordSchema), resetPassword);
router.get('/me', authMiddleware, me);
// Audit : journal de connexion du compte courant (soi-même uniquement)
router.get('/me/login-activity', authMiddleware, loginActivity);
// Profil : chaque utilisateur met à jour UNIQUEMENT le sien (liste blanche zod)
router.patch('/profile', authMiddleware, validate(updateProfileSchema), updateProfile);
// Sécurité : changement de mot de passe avec preuve du mot de passe actuel
router.post('/change-password', authMiddleware, validate(changePasswordSchema), changePassword);

// --- Double authentification (2FA) — réservée aux comptes internes ---
router.get('/2fa/status', authMiddleware, requireUtilisateurInterne, getStatus);
router.post('/2fa/setup', authMiddleware, requireUtilisateurInterne, setup);
router.post('/2fa/verify-setup', authMiddleware, requireUtilisateurInterne, validate(twoFactorVerifySetupSchema), verifySetup);
router.post('/2fa/disable', authMiddleware, requireUtilisateurInterne, validate(twoFactorDisableSchema), disable);
// Second facteur de connexion : jeton temporaire + code OTP (public, sans session)
router.post('/2fa/verify-login', validate(twoFactorVerifyLoginSchema), verifyLogin);

module.exports = router;
