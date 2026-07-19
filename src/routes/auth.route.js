const express = require('express');
const router  = express.Router();
const authController = require('../controllers/auth.controller');
const { authRateLimit, otpEmailRateLimit } = require('../middlewares/rateLimit.middleware');
const validate = require('../middlewares/validate.middleware');
const {
  registerSchema,
  loginSchema,
  refreshSchema,
  logoutSchema,
  forgotPasswordSchema,
  resetPasswordSchema
} = require('../validations/auth.validation');

router.post('/register', validate(registerSchema), authController.inscriptionUser);
router.post('/login',    authRateLimit, validate(loginSchema), authController.login);

// Refresh token — rate-limité pour éviter les abus
router.post('/refresh', authRateLimit, validate(refreshSchema), authController.refresh);

// Logout — révoque le refresh token côté serveur
router.post('/logout', validate(logoutSchema), authController.logout);

// Mot de passe oublié / réinitialisation
router.post('/oublier-password', authRateLimit, otpEmailRateLimit, validate(forgotPasswordSchema), authController.oublierPassword);
router.post('/reset-password', authRateLimit, otpEmailRateLimit, validate(resetPasswordSchema), authController.resetPassword);

// NB : modifier-profil / modifier-password ont été retirés (dead code, jamais
// appelés — le mobile et l'admin utilisent /account/modifier-profil et
// /account/change-password, voir account.route.js).

module.exports = router;
