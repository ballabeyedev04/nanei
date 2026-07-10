const express = require('express');
const router = express.Router();
const ctrl = require('../../controllers/admin/serviceRate.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const auditLog = require('../../middlewares/auditlog.middleware');

router.use(authMiddleware);

router.get('/',      ctrl.getAll);
router.get('/:id',   ctrl.getById);
router.post('/',     auditLog('CREATE', 'ServiceRate'), ctrl.create);
router.put('/:id',   auditLog('UPDATE', 'ServiceRate'), ctrl.update);
router.delete('/:id', auditLog('DELETE', 'ServiceRate'), ctrl.delete);

module.exports = router;
