const express = require('express');
const router = express.Router();
const envoieColisController = require('../../controllers/client/envoieColis.controller');
const authMiddleware = require('../../middlewares/auth.middleware');

// Route pour envoyer un colis (POST)
router.post('/envoie-colis', authMiddleware, envoieColisController.envoieColisController);

// Route pour envoyer plusieurs colis en une seule commande groupée (regroupement)
router.post('/envoie-colis-lot', authMiddleware, envoieColisController.envoieColisLotController);

// Pays actifs + pricing (pour le mobile)
router.get('/countries', authMiddleware, envoieColisController.getCountriesController);
router.get('/pricing/:countryId', authMiddleware, envoieColisController.getPricingByCountryController);

// Route pour rechercher un client par nom, prénom ou email (GET)
router.get('/rechercher-client', authMiddleware, envoieColisController.rechercherClientController);

// 🔹 Rechercher un colis par référence (scan QR code de l'étiquette)
router.get('/colis-recherche/:reference', authMiddleware, envoieColisController.rechercherColisParReferenceController);

// 🔹 Récupérer tous les colis envoyés par l'utilisateur
router.get('/colis-envoyes', authMiddleware, envoieColisController.getColisEnvoyesController);

// 🔹 Récupérer tous les colis reçus par l'utilisateur
router.get('/colis-recus', authMiddleware, envoieColisController.getColisRecusController);

router.get(
  '/statistiques-colis',
  authMiddleware,
  envoieColisController.statistiquesColis
);

router.get('/mes-notifications', authMiddleware, envoieColisController.getNotificationsController);

router.patch('/lire-notifications/:notificationId', authMiddleware, envoieColisController.marquerNotificationCommeLueController);

module.exports = router;