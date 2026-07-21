const express = require('express');
const router = express.Router();
const pricingController = require('../controllers/pricing.controller');

// Route publique pour calculer le prix
router.post('/calculate', pricingController.calculatePrice);

// Route publique pour récupérer le taux de change EUR -> FCFA (affichage
// double devise dans le mobile)
router.get('/taux-change', pricingController.getTauxChange);

module.exports = router;
