const express  = require('express');
const router   = express.Router();
const ctrl     = require('../../controllers/client/paiement.controller');
const auth     = require('../../middlewares/auth.middleware');
const validateWebhookSignature = require('../../middlewares/webhookSignature.middleware'); // SÉCURITÉ: Validation signature webhook
const validatePaymentAmount = require('../../middlewares/paymentValidation.middleware'); // SÉCURITÉ: Validation montants

// Routes protégées
router.get('/',                         auth, ctrl.mesPaiements);
router.post('/:colisId/initier',        auth, validatePaymentAmount, ctrl.initierPaiement);

// Retour navigateur après paiement (pas de auth — redirect depuis le provider)
router.get('/retour',                   ctrl.retourPaiement);

// SÉCURITÉ: Webhooks avec validation HMAC signature
router.post('/webhook/wave',            validateWebhookSignature('wave'),         ctrl.webhookWave);
router.post('/webhook/orange_money',    validateWebhookSignature('orange_money'), ctrl.webhookOrangeMoney);

module.exports = router;
