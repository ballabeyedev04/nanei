const logger = require('../config/logger');

const PAYMENT_CONFIG = {
  MIN_AMOUNT: 100,      // XOF
  MAX_AMOUNT: 10000000, // XOF
};

/** Valide les montants de paiement */
const validatePaymentAmount = (req, res, next) => {
  try {
    const { amount, montant, prix, colisId } = req.body || {};
    const amountValue = amount || montant || prix;

    if (!amountValue) {
      return res.status(400).json({
        success: false,
        message: 'Montant manquant'
      });
    }

    const numAmount = parseFloat(amountValue);
    if (isNaN(numAmount)) {
      return res.status(400).json({
        success: false,
        message: 'Montant invalide'
      });
    }

    // SÉCURITÉ: Valider les limites
    if (numAmount < PAYMENT_CONFIG.MIN_AMOUNT) {
      logger.warn('Paiement : montant trop bas rejeté', {
        amount: numAmount,
        min: PAYMENT_CONFIG.MIN_AMOUNT,
        colisId,
      });
      return res.status(400).json({
        success: false,
        message: `Montant minimum : ${PAYMENT_CONFIG.MIN_AMOUNT} XOF`
      });
    }

    if (numAmount > PAYMENT_CONFIG.MAX_AMOUNT) {
      logger.warn('Paiement : montant trop élevé rejeté', {
        amount: numAmount,
        max: PAYMENT_CONFIG.MAX_AMOUNT,
        colisId,
      });
      return res.status(400).json({
        success: false,
        message: `Montant maximum : ${PAYMENT_CONFIG.MAX_AMOUNT} XOF`
      });
    }

    // SÉCURITÉ: Vérifier les décimales pour éviter les abus (max 2 décimales)
    const decimalPlaces = (numAmount.toString().split('.')[1] || '').length;
    if (decimalPlaces > 2) {
      logger.warn('Paiement : trop de décimales rejeté', {
        amount: numAmount,
        colisId,
      });
      return res.status(400).json({
        success: false,
        message: 'Maximum 2 décimales autorisées'
      });
    }

    req.validatedAmount = numAmount;
    next();
  } catch (err) {
    logger.error('Erreur validation montant', { error: err.message });
    return res.status(500).json({
      success: false,
      message: 'Erreur validation'
    });
  }
};

module.exports = validatePaymentAmount;
