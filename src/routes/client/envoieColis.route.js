const express = require('express');
const router = express.Router();
const envoieColisController = require('../../controllers/client/envoieColis.controller');
const authMiddleware = require('../../middlewares/auth.middleware');

// Route pour envoyer un colis (POST)
router.post('/envoie-colis', authMiddleware, envoieColisController.envoieColisController);

// Route pour rechercher un client par nom, prénom ou email (GET)
router.get('/rechercher-client', authMiddleware, envoieColisController.rechercherClientController);

// 🔹 Récupérer tous les colis envoyés par l'utilisateur
router.get('/colis-envoyes', authMiddleware, envoieColisController.getColisEnvoyesController);

// 🔹 Récupérer tous les colis reçus par l'utilisateur
router.get('/colis-recus', authMiddleware, envoieColisController.getColisRecusController);

module.exports = router;