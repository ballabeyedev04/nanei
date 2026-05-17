const express = require('express');
const router = express.Router();
const controller = require('../../controllers/admin/gestoncolis.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const isAdmin = require('../../middlewares/isAdmin.middlewares');

// 🔹 colis envoyés
router.get(
    '/colis-envoyes',
    authMiddleware,
    isAdmin,
    controller.listeColisEnvoyes
);

// 🔹 colis en attente
router.get(
    '/colis-attente',
    authMiddleware,
    isAdmin,
    controller.listeColisEnAttente
);

// 🔹 nombre colis
router.get(
    '/nombre-colis',
    authMiddleware,
    isAdmin,
    controller.nombreColis
);

// 🔹 statistiques statut
router.get(
    '/statistiques-colis',
    authMiddleware,
    isAdmin,
    controller.nombreParStatut
);

module.exports = router;
