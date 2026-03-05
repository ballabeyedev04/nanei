const express = require('express');
const router = express.Router();
const controller = require('../../controllers/admin/gestionutilisateur.controller');
const authMiddleware = require('../../middlewares/auth.middleware');

// 🔹 liste utilisateurs particuliers
router.get('/liste-utilisateurs', authMiddleware, controller.listeUtilisateur);

// 🔹 activer utilisateur
router.patch('/activer-utilisateurs/:id',authMiddleware, controller.activerUtilisateur);

// 🔹 désactiver utilisateur
router.patch('/desactiver-utilisateurs/:id',authMiddleware, controller.desactiverUtilisateur);

router.get(
  '/nombre-utilisateurs',
  authMiddleware,
  controller.nombreUtilisateursParticuliers
);
module.exports = router;
