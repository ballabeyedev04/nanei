const express = require('express');
const router = express.Router();
const controller = require('../../controllers/admin/gestoncolis.controller');
const authMiddleware = require('../../middlewares/auth.middleware');

// 🔹 colis envoyés
router.get('/colis-envoyes', authMiddleware, controller.listeColisEnvoyes);

// 🔹 colis en attente
router.get('/colis-attente', authMiddleware, controller.listeColisEnAttente);

// 🔹 nombre colis
router.get('/nombre-colis', authMiddleware, controller.nombreColis);

// 🔹 statistiques statut
router.get('/statistiques-colis', authMiddleware, controller.nombreParStatut);

module.exports = router;
