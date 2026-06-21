const express = require('express');
const router  = express.Router();
const accountController = require('../controllers/account.controller');
const upload   = require('../middlewares/upload.middleware');
const auth     = require('../middlewares/auth.middleware');
const checkActiveUser = require('../middlewares/checkActiveUser.middleware');
const { authRateLimit } = require('../middlewares/rateLimit.middleware');
const validate = require('../middlewares/validate.middleware');
const {
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  modifierProfilSchema
} = require('../validations/account.validation');

// ── Profil courant (ne lit pas le token, interroge la DB) ────────────────────
router.get('/me', auth, accountController.me);

// ── Modifier profil ───────────────────────────────────────────────────────────
router.put(
  '/modifier-profil',
  auth,
  checkActiveUser,
  upload.single('photoProfil'),
  validate(modifierProfilSchema),
  accountController.updateProfile
);

// ── Mot de passe ──────────────────────────────────────────────────────────────
router.post(
  '/forgot-password',
  authRateLimit,
  validate(forgotPasswordSchema),
  accountController.forgotPassword
);

router.post(
  '/reset-password',
  authRateLimit,
  validate(resetPasswordSchema),
  accountController.resetPassword
);

router.put(
  '/change-password',
  auth,
  checkActiveUser,
  validate(changePasswordSchema),
  accountController.changePassword
);

// ── FCM Token ─────────────────────────────────────────────────────────────────
router.post('/fcm-token', auth, accountController.updateFcmToken);

// ── Suppression de compte (RGPD) ──────────────────────────────────────────────
router.delete('/', auth, accountController.deleteAccount);

module.exports = router;
