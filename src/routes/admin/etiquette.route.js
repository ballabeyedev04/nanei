const express = require('express');
const router = express.Router();
const etiquetteController = require('../../controllers/admin/etiquette.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const isAdmin = require('../../middlewares/isAdmin.middlewares');

router.use(authMiddleware);
router.use(isAdmin);

// GET /nanei/admin/etiquettes/:colisId — télécharger l'étiquette d'un colis
router.get('/:colisId', etiquetteController.genererEtiquetteAdmin);

module.exports = router;
