const express = require('express');
const router = express.Router();
const envoieColisController = require('../../controllers/client/envoieColis.controller');
const authMiddleware = require('../../middlewares/auth.middleware');

// Route pour envoyer un colis (POST)
router.post('/envoie-colis', authMiddleware, envoieColisController.envoieColisController);

// Route pour rechercher un client par nom, prénom ou email (GET)
router.get('/rechercher-client', authMiddleware, envoieColisController.rechercherClientController);

module.exports = router;