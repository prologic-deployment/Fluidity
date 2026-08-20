const { Router } = require('express');
const {
  register,
  login,
  loginActivity,
  forgotPassword,
  resetPassword,
  me,
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

// --- Authentification publique ---
router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.post('/forgot-password', validate(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', validate(resetPasswordSchema), resetPassword);

// --- 2FA (second facteur de connexion — public, jeton temporaire requis) ---
router.post('/2fa/verify-login', validate(twoFactorVerifyLoginSchema), verifyLogin);

// --- Profil / sécurité (authentifié) ---
router.get('/me', authMiddleware, me);
router.patch('/profile', authMiddleware, validate(updateProfileSchema), updateProfile);
router.post('/change-password', authMiddleware, validate(changePasswordSchema), changePassword);
router.get('/login-activity', authMiddleware, loginActivity);

// --- 2FA (gestion par l'utilisateur authentifié) ---
router.get('/2fa/status', authMiddleware, getStatus);
router.post('/2fa/setup', authMiddleware, setup);
router.post('/2fa/verify-setup', authMiddleware, validate(twoFactorVerifySetupSchema), verifySetup);
router.post('/2fa/disable', authMiddleware, validate(twoFactorDisableSchema), disable);

module.exports = router;
