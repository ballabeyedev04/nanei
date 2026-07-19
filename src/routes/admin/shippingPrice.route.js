const express = require('express');
const router = express.Router();
const shippingPriceController = require('../../controllers/admin/shippingPrice.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const isAdmin = require('../../middlewares/isAdmin.middlewares');
const auditLog = require('../../middlewares/auditlog.middleware');

// Toutes les routes sont protégées - admin seulement
router.use(authMiddleware);
router.use(isAdmin);

router.get('/', shippingPriceController.getShippingPrices);
router.get('/:id', shippingPriceController.getShippingPriceById);
router.post('/', auditLog('CREATE', 'ShippingPrice'), shippingPriceController.createShippingPrice);
router.post('/bulk', auditLog('BULK_UPSERT', 'ShippingPrice'), shippingPriceController.createOrUpdateBulk);
router.put('/:id', auditLog('UPDATE', 'ShippingPrice'), shippingPriceController.updateShippingPrice);
router.delete('/:id', auditLog('DELETE', 'ShippingPrice'), shippingPriceController.deleteShippingPrice);

module.exports = router;
