const express = require('express');
const router  = express.Router();
const ctrl    = require('../../controllers/admin/paiement.controller');
const auth    = require('../../middlewares/auth.middleware');
const isAdmin = require('../../middlewares/isAdmin.middlewares');
const auditLog = require('../../middlewares/auditlog.middleware');

router.use(auth, isAdmin);

router.get('/',           ctrl.listePaiements);
router.get('/stats',      ctrl.statistiques);
router.put('/:id/statut', auditLog('UPDATE_STATUT', 'Paiement'), ctrl.changerStatut);

module.exports = router;
