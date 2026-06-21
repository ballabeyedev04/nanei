const express  = require('express');
const router   = express.Router();
const ctrl     = require('../../controllers/client/paiement.controller');
const auth     = require('../../middlewares/auth.middleware');

// Routes protégées
router.get('/',                         auth, ctrl.mesPaiements);
router.post('/:colisId/initier',        auth, ctrl.initierPaiement);

// Retour navigateur après paiement (pas de auth — redirect depuis le provider)
router.get('/retour',                   ctrl.retourPaiement);

// Webhooks providers (pas de auth — appelés par Wave / Orange Money)
router.post('/webhook/wave',            ctrl.webhookWave);
router.post('/webhook/orange_money',    ctrl.webhookOrangeMoney);

module.exports = router;
