const { Router } = require('express');
const { register, login, forgotPassword, resetPassword, me } = require('../controllers/auth.controller');
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

// --- Double authentification (2FA) — l'utilisateur gère SA propre config ---
router.get('/2fa/status', authMiddleware, getStatus);
router.post('/2fa/setup', authMiddleware, setup);
router.post('/2fa/verify-setup', authMiddleware, validate(twoFactorVerifySetupSchema), verifySetup);
router.post('/2fa/disable', authMiddleware, validate(twoFactorDisableSchema), disable);
// Second facteur de connexion : jeton temporaire + code OTP (public, sans session)
router.post('/2fa/verify-login', validate(twoFactorVerifyLoginSchema), verifyLogin);

module.exports = router;
