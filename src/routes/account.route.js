const express = require('express');
const router  = express.Router();
const accountController = require('../controllers/account.controller');
const upload   = require('../middlewares/upload.middleware');
const auth     = require('../middlewares/auth.middleware');
const checkActiveUser = require('../middlewares/checkActiveUser.middleware');
const { mutationRateLimit } = require('../middlewares/rateLimit.middleware');
const validate = require('../middlewares/validate.middleware');
const {
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
  mutationRateLimit,
  upload.single('photoProfil'),
  validate(modifierProfilSchema),
  accountController.updateProfile
);

// NB : /forgot-password et /reset-password ont été retirés (dead code,
// jamais appelés — le mobile utilise /auth/oublier-password et
// /auth/reset-password, voir routes/auth.route.js).

// ── Mot de passe ──────────────────────────────────────────────────────────────
router.put(
  '/change-password',
  auth,
  checkActiveUser,
  mutationRateLimit,
  validate(changePasswordSchema),
  accountController.changePassword
);

// ── FCM Token ─────────────────────────────────────────────────────────────────
router.post('/fcm-token', auth, accountController.updateFcmToken);

// ── Suppression de compte (RGPD) ──────────────────────────────────────────────
router.delete('/', auth, mutationRateLimit, accountController.deleteAccount);

module.exports = router;
