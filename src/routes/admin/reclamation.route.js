const express = require('express');
const router = express.Router();
const reclamationController = require('../../controllers/client/reclamation.controller');
const auth = require('../../middlewares/auth.middleware');
const isAdmin = require('../../middlewares/isAdmin.middlewares');
const auditLog = require('../../middlewares/auditlog.middleware');

// GET / — liste toutes les réclamations (avec filtre ?statut=)
router.get('/', auth, isAdmin, reclamationController.adminList);

// PUT /:id — mettre à jour le statut d'une réclamation
router.put('/:id', auth, isAdmin, auditLog('UPDATE_STATUT', 'Reclamation'), reclamationController.adminUpdate);

module.exports = router;
