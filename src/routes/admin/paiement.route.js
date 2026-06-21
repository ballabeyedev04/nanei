const express = require('express');
const router  = express.Router();
const ctrl    = require('../../controllers/admin/paiement.controller');
const auth    = require('../../middlewares/auth.middleware');
const isAdmin = require('../../middlewares/isAdmin.middlewares');

router.use(auth, isAdmin);

router.get('/',           ctrl.listePaiements);
router.get('/stats',      ctrl.statistiques);
router.put('/:id/statut', ctrl.changerStatut);

module.exports = router;
