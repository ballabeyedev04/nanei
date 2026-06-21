const express = require('express');
const router = express.Router();
const etiquetteController = require('../../controllers/client/etiquette.controller');
const auth = require('../../middlewares/auth.middleware');

// GET /nanei/etiquettes/:colisId
router.get('/:colisId', auth, etiquetteController.genererEtiquetteClient);

module.exports = router;
