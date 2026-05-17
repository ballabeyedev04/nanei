const express = require('express');
const router = express.Router();
const controller = require('../../controllers/admin/gestionadmin.controller');
const authMiddleware = require('../../middlewares/auth.middleware');

//liste admins
router.get('/liste-admins', authMiddleware.protect, authMiddleware.checkRole('Admin'), controller.listeAdmins);

//ajouter admin
router.post('/ajouter-admin', authMiddleware.protect, authMiddleware.checkRole('Admin'), controller.ajouterAdmin);

//activer admin
router.put('/activer-admin/:id', authMiddleware.protect, authMiddleware.checkRole('Admin'), controller.activerAdmin);

//desactiver admin
router.put('/desactiver-admin/:id', authMiddleware.protect, authMiddleware.checkRole('Admin'), controller.desactiverAdmin);

module.exports = router;