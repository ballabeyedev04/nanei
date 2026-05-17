const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');


router.post('/login', authController.login);
router.post('/register', authController.inscriptionUser);

// route pour modifier password
router.put('/modifier-password/:id', authController.modifierPassword);
// route pour modifier profil
router.put('/modifier-profil/:id', authController.modifierProfil);
// route pour oublier password
router.post('/oublier-password', authController.oublierPassword);
// route pour reset password
router.post('/reset-password/:token', authController.resetPassword);


module.exports = router;
