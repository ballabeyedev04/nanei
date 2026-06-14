const express = require('express');
const router = express.Router();
const pricingController = require('../controllers/pricing.controller');

// Route publique pour calculer le prix
router.post('/calculate', pricingController.calculatePrice);

module.exports = router;
