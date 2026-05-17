const express = require('express');
const router = express.Router();
const controller = require('../../controllers/admin/gestionutilisateur.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const isAdmin = require('../../middlewares/isAdmin.middlewares');

// 🔹 liste utilisateurs particuliers
router.get(
  '/liste-utilisateurs',
  authMiddleware,
  isAdmin,
  controller.listeUtilisateur
);

// 🔹 activer utilisateur
router.patch(
  '/activer-utilisateurs/:id',
  authMiddleware,
  isAdmin,
  controller.activerUtilisateur
);

// 🔹 désactiver utilisateur
router.patch(
  '/desactiver-utilisateurs/:id',
  authMiddleware,
  isAdmin,
  controller.desactiverUtilisateur
);

router.get(
  '/nombre-utilisateurs',
  authMiddleware,
  isAdmin,
  controller.nombreUtilisateursParticuliers
);

router.get('/hello', controller.hello);
module.exports = router;
