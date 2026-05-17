const express = require('express');
const router = express.Router();
const controller = require('../../controllers/admin/gestoncolis.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const isAdmin = require('../../middlewares/isAdmin.middlewares');


/* ===================== COLIS ===================== */
router.get(
    '/liste-colis',
    authMiddleware,
    isAdmin,
    controller.listeTousLesColis
);
router.get(
    '/nombre-colis',
    authMiddleware,
    isAdmin,
    controller.nombreColis
);

/* ===================== EN ATTENTE ===================== */
router.get(
    '/colis-en-attente',
    authMiddleware,
    isAdmin,
    controller.listeColisEnAttente
);
router.get(
    '/nombre-colis-en-attente',
    authMiddleware,
    isAdmin,
    controller.nombreColisEnAttente
);

/* ===================== LIVRÉS ===================== */
router.get(
    '/colis-livres',
    authMiddleware,
    isAdmin,
    controller.listeColisLivres
);
router.get(
    '/nombre-colis-livres',
    authMiddleware,
    isAdmin,
    controller.nombreColisLivres
);

/* ===================== RÉCUPÉRÉS ===================== */
router.get(
    '/colis-recuperes',
    authMiddleware,
    isAdmin,
    controller.listeColisRecuperes
);
router.get(
    '/nombre-colis-recuperes',
    authMiddleware,
    isAdmin,
    controller.nombreColisRecuperes
);

/* ===================== RECHERCHE ===================== */
router.get(
    '/colis-recherche/:reference',
    authMiddleware,
    isAdmin,
    controller.rechercherColis
);

/* ===================== STATUT COLIS ===================== */

// mettre en attente
router.put(
    '/changer-statut-en-attente/:id',
    authMiddleware,
    isAdmin,
    gestionColisController.changerEnAttente
);

// marquer livré
router.put(
    'changer-statut-livre/:id',
    authMiddleware,
    isAdmin,
    gestionColisController.changerEnLivre
);
// marquer récupéré
router.put(
    '/changer-statut-recupere/:id',
    authMiddleware,
    isAdmin,
    gestionColisController.changerEnRecupere
);
module.exports = router;
