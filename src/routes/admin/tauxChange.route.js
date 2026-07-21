const express = require('express');
const router = express.Router();
const ctrl = require('../../controllers/admin/tauxChange.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const isAdmin = require('../../middlewares/isAdmin.middlewares');
const auditLog = require('../../middlewares/auditlog.middleware');

router.use(authMiddleware);
router.use(isAdmin);

// Pas de POST ni de DELETE : le taux de change est modifiable uniquement,
// jamais créé ni supprimé depuis l'admin (une seule ligne gérée via seed).
router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getById);
router.put('/:id', auditLog('UPDATE', 'TauxChange'), ctrl.update);

module.exports = router;
