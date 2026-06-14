const express = require('express');
const router = express.Router();
const shippingPriceController = require('../../controllers/admin/shippingPrice.controller');
const authMiddleware = require('../../middlewares/auth.middleware');

// Toutes les routes sont protégées - admin seulement
router.use(authMiddleware);

router.get('/', shippingPriceController.getShippingPrices);
router.get('/:id', shippingPriceController.getShippingPriceById);
router.post('/', shippingPriceController.createShippingPrice);
router.put('/:id', shippingPriceController.updateShippingPrice);
router.delete('/:id', shippingPriceController.deleteShippingPrice);

module.exports = router;
