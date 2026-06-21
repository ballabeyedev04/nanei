const express = require('express');
const router = express.Router();
const reclamationController = require('../../controllers/client/reclamation.controller');
const auth = require('../../middlewares/auth.middleware');
const isAdmin = require('../../middlewares/isAdmin.middlewares');

// GET / — liste toutes les réclamations (avec filtre ?statut=)
router.get('/', auth, isAdmin, reclamationController.adminList);

// PUT /:id — mettre à jour le statut d'une réclamation
router.put('/:id', auth, isAdmin, reclamationController.adminUpdate);

module.exports = router;
