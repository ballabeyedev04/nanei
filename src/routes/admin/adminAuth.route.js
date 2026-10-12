const express = require('express');
const router = express.Router();
const adminAuthController = require('../../controllers/adminAuth.controller');
const { motDePasseRateLimit } = require('../../middlewares/rateLimit.middleware');

/**
 * Routes de réinitialisation de mot de passe pour les administrateurs.
 * Ces routes sont publiques (pas de JWT requis) mais rate-limitées.
 *
 * POST /nanei/admin/forgot-password   → demande de réinitialisation
 * POST /nanei/admin/reset-password    → confirmation avec token + nouveau mdp
 */

// Rate limit strict : 5 tentatives / 15 min (compteur propre aux mots de passe,
// distinct de celui de la connexion)
router.post('/forgot-password', motDePasseRateLimit, adminAuthController.forgotPassword);
router.post('/reset-password',  motDePasseRateLimit, adminAuthController.resetPassword);

module.exports = router;
