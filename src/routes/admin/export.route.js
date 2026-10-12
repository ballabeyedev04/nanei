const express = require('express');
const router = express.Router();
const exportController = require('../../controllers/admin/export.controller');
const auth = require('../../middlewares/auth.middleware');
const isAdmin = require('../../middlewares/isAdmin.middlewares');
const auditLog = require('../../middlewares/auditlog.middleware');

// Chaque export (données personnelles de tous les clients) est tracé dans le
// journal d'audit, avec ses filtres (details.query).

// GET /nanei/admin/export/colis?format=csv|xlsx&statut=...&date_debut=...&date_fin=...
router.get('/colis', auth, isAdmin, auditLog('EXPORT', 'Colis'), exportController.exportColis);

// GET /nanei/admin/export/paiements
router.get('/paiements', auth, isAdmin, auditLog('EXPORT', 'Paiement'), exportController.exportPaiements);

module.exports = router;
