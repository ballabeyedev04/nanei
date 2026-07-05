const crypto = require('crypto');
const logger = require('../config/logger');

/** Valide la signature HMAC pour les webhooks Wave et Orange Money */
const validateWebhookSignature = (provider) => {
  return (req, res, next) => {
    try {
      const signature = req.headers['x-signature'] || req.headers['x-wave-signature'];
      if (!signature) {
        logger.warn(`Webhook ${provider} rejeté : signature manquante`, {
          ip: req.ip,
          provider,
        });
        return res.status(401).json({ error: 'Signature manquante' });
      }

      const secret = provider === 'wave'
        ? process.env.WAVE_WEBHOOK_SECRET
        : process.env.ORANGE_MONEY_WEBHOOK_SECRET;

      if (!secret) {
        logger.error(`Webhook ${provider} : secret ${provider} manquant en config`, { provider });
        return res.status(500).json({ error: 'Configuration manquante' });
      }

      // Récupérer le body brut pour vérifier la signature
      const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(rawBody)
        .digest('hex');

      if (signature !== expectedSignature) {
        logger.warn(`Webhook ${provider} rejeté : signature invalide`, {
          ip: req.ip,
          provider,
          expected: expectedSignature.substring(0, 16) + '...',
          got: signature.substring(0, 16) + '...',
        });
        return res.status(401).json({ error: 'Signature invalide' });
      }

      logger.info(`Webhook ${provider} signature valide`, { provider });
      next();
    } catch (err) {
      logger.error(`Webhook ${provider} erreur validation signature`, { error: err.message, provider });
      return res.status(500).json({ error: 'Erreur validation' });
    }
  };
};

module.exports = validateWebhookSignature;
