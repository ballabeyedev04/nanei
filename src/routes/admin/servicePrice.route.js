const express = require('express');
const router = express.Router();
const servicePriceController = require('../../controllers/admin/servicePrice.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const auditLog = require('../../middlewares/auditlog.middleware');

// Toutes les routes sont protégées - admin seulement
router.use(authMiddleware);

router.get('/', servicePriceController.getServicePrices);
router.get('/:id', servicePriceController.getServicePriceById);
router.post('/', auditLog('CREATE', 'ServicePrice'), servicePriceController.createServicePrice);
router.put('/:id', auditLog('UPDATE', 'ServicePrice'), servicePriceController.updateServicePrice);
router.delete('/:id', auditLog('DELETE', 'ServicePrice'), servicePriceController.deleteServicePrice);

module.exports = router;
