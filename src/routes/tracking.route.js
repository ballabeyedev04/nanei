const express = require('express');
const router = express.Router();
const trackingController = require('../controllers/tracking.controller');
const { suiviPublicRateLimit } = require('../middlewares/rateLimit.middleware');

// GET /nanei/suivi/:reference — public, sans authentification
router.get('/:reference', suiviPublicRateLimit, trackingController.suivrePublic);

module.exports = router;
