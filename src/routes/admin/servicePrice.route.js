const express = require('express');
const router = express.Router();
const servicePriceController = require('../../controllers/admin/servicePrice.controller');
const authMiddleware = require('../../middlewares/auth.middleware');

// Toutes les routes sont protégées - admin seulement
router.use(authMiddleware);

router.get('/', servicePriceController.getServicePrices);
router.get('/:id', servicePriceController.getServicePriceById);
router.post('/', servicePriceController.createServicePrice);
router.put('/:id', servicePriceController.updateServicePrice);
router.delete('/:id', servicePriceController.deleteServicePrice);

module.exports = router;
