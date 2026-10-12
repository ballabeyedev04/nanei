const express = require('express');
const router = express.Router();
const { paginerReponse } = require('../../utils/pagination');
const servicePriceController = require('../../controllers/admin/servicePrice.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const isAdmin = require('../../middlewares/isAdmin.middlewares');
const auditLog = require('../../middlewares/auditlog.middleware');

// Toutes les routes sont protégées - admin seulement
router.use(authMiddleware);
router.use(isAdmin);

router.get('/', paginerReponse('data'), servicePriceController.getServicePrices); // pagination facultative ?page=&limit=
router.get('/:id', servicePriceController.getServicePriceById);
router.post('/', auditLog('CREATE', 'ServicePrice'), servicePriceController.createServicePrice);
router.put('/:id', auditLog('UPDATE', 'ServicePrice'), servicePriceController.updateServicePrice);
router.delete('/:id', auditLog('DELETE', 'ServicePrice'), servicePriceController.deleteServicePrice);

module.exports = router;
