const express = require('express');
const router = express.Router();
const ctrl = require('../../controllers/admin/shippingRate.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const isAdmin = require('../../middlewares/isAdmin.middlewares');
const auditLog = require('../../middlewares/auditlog.middleware');

router.use(authMiddleware);
router.use(isAdmin);

router.get('/',     ctrl.getAll);
router.get('/:id',  ctrl.getById);
router.post('/',    auditLog('CREATE', 'ShippingRate'), ctrl.create);
router.put('/:id',  auditLog('UPDATE', 'ShippingRate'), ctrl.update);
router.delete('/:id', auditLog('DELETE', 'ShippingRate'), ctrl.delete);

module.exports = router;
