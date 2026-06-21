const express = require('express');
const router = express.Router();
const exportController = require('../../controllers/admin/export.controller');
const auth = require('../../middlewares/auth.middleware');
const isAdmin = require('../../middlewares/isAdmin.middlewares');

// GET /nanei/admin/export/colis?format=csv|xlsx&statut=...&date_debut=...&date_fin=...
router.get('/colis', auth, isAdmin, exportController.exportColis);

// GET /nanei/admin/export/paiements
router.get('/paiements', auth, isAdmin, exportController.exportPaiements);

module.exports = router;
