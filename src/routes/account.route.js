const express = require('express');
const router = express.Router();
const accountController = require('../controllers/account.controller');
const upload = require('../middlewares/upload.middleware');
const auth = require('../middlewares/auth.middleware');

router.post(
  '/updateProfile',
  auth,
  upload.single('photoProfil'),
  accountController.updateProfile
);

router.post(
  '/forgot-password',
  accountController.forgotPassword
);

router.put(
  '/change-password',
  auth,
  accountController.changePassword
);

module.exports = router;
