const express = require('express');
const router = express.Router();
const reclamationController = require('../../controllers/client/reclamation.controller');
const auth = require('../../middlewares/auth.middleware');

// POST / — créer une réclamation avec photos
router.post('/', auth, reclamationController.upload.array('photos', 5), reclamationController.creer);

// GET / — mes réclamations
router.get('/', auth, reclamationController.mesList);

// GET /:id — détail d'une réclamation
router.get('/:id', auth, reclamationController.detail);

module.exports = router;
