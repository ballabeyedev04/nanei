const express = require('express');
const router = express.Router();
const controller = require('../../controllers/admin/gestionadmin.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const isAdmin = require('../../middlewares/isAdmin.middlewares');

//liste admins
router.get(
    '/liste-admins',
    authMiddleware,
    isAdmin,
    controller.listeAdmins
);

//ajouter admin
router.post(
    '/ajouter-admin',
    authMiddleware,
    isAdmin,
    controller.ajouterAdmin
);

//activer admin
router.put(
    '/activer-admin/:id',
    authMiddleware,
    isAdmin,
    controller.activerAdmin
);

//desactiver admin
router.put(
    '/desactiver-admin/:id',
    authMiddleware,
    isAdmin,
    controller.desactiverAdmin
);

module.exports = router;