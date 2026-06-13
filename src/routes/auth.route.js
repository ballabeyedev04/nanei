const express = require('express');
const router  = express.Router();
const authController = require('../controllers/auth.controller');
const { authRateLimit } = require('../middlewares/rateLimit.middleware');
const validate = require('../middlewares/validate.middleware');
const {
  registerSchema,
  loginSchema,
  refreshSchema,
  logoutSchema,
  forgotPasswordSchema,
  resetPasswordSchema
} = require('../validations/auth.validation');
const authMiddleware = require('../middlewares/auth.middleware');

router.post('/register', validate(registerSchema), authController.inscriptionUser);
router.post('/login',    authRateLimit, validate(loginSchema), authController.login);

// Refresh token — rate-limité pour éviter les abus
router.post('/refresh', authRateLimit, validate(refreshSchema), authController.refresh);

// Logout — révoque le refresh token côté serveur
router.post('/logout', validate(logoutSchema), authController.logout);

// Mot de passe oublié / réinitialisation
router.post('/oublier-password', authRateLimit, validate(forgotPasswordSchema), authController.oublierPassword);
router.post('/reset-password/:token', authRateLimit, validate(resetPasswordSchema), authController.resetPassword);

// Modifier profil / mot de passe (protégé)
router.put('/modifier-password/:id', authMiddleware, authController.modifierPassword);
router.put('/modifier-profil/:id',   authMiddleware, authController.modifierProfil);

module.exports = router;
