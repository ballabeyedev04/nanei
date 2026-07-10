const express = require('express');
const router = express.Router();
const preuveController = require('../../controllers/admin/preuve.controller');
const auth = require('../../middlewares/auth.middleware');
const isAdmin = require('../../middlewares/isAdmin.middlewares');
const auditLog = require('../../middlewares/auditlog.middleware');

// POST /nanei/admin/colis/:colisId/preuve
router.post(
  '/colis/:colisId/preuve',
  auth,
  isAdmin,
  preuveController.upload.single('photo'),
  auditLog('CREATE', 'PreuveLivraison'),
  preuveController.ajouterPreuve
);

// GET /nanei/admin/colis/:colisId/preuve
router.get('/colis/:colisId/preuve', auth, isAdmin, preuveController.voirPreuve);

module.exports = router;
