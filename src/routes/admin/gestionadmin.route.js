const express = require('express');
const router = express.Router();
const controller = require('../../controllers/admin/gestionadmin.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const isAdmin = require('../../middlewares/isAdmin.middlewares');
const auditLog = require('../../middlewares/auditlog.middleware');

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
    auditLog('CREATE', 'Admin'),
    controller.ajouterAdmin
);

//activer admin
router.put(
    '/activer-admin/:id',
    authMiddleware,
    isAdmin,
    auditLog('ACTIVATE', 'Admin'),
    controller.activerAdmin
);

//desactiver admin
router.put(
    '/desactiver-admin/:id',
    authMiddleware,
    isAdmin,
    auditLog('DEACTIVATE', 'Admin'),
    controller.desactiverAdmin
);

//nombre d'admins
router.get(
    '/nombre-admins',
    authMiddleware,
    isAdmin,
    controller.nombreAdmins
);

//rechercher admin
router.get(
    '/rechercher-admin',
    authMiddleware,
    isAdmin,
    controller.rechercherAdmin
);

module.exports = router;