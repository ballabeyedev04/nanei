const crypto = require('crypto');
const logger = require('../config/logger');

const TOLERANCE_SECONDES = 5 * 60; // anti-rejeu pour le format horodaté

function egal(a, b) {
  const x = Buffer.from(String(a), 'utf8');
  const y = Buffer.from(String(b), 'utf8');
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

const hmac = (secret, contenu) => crypto.createHmac('sha256', secret).update(contenu).digest('hex');

/**
 * Valide la signature HMAC-SHA256 des webhooks Wave et Orange Money.
 *
 * La signature est calculée sur le CORPS BRUT reçu (`req.rawBody`, conservé
 * par express.json dans app.js). Avant, elle l'était sur
 * `JSON.stringify(req.body)` : un corps reconstruit, différent de l'original
 * dès qu'un espace ou l'ordre des clés change → webhooks légitimes rejetés.
 *
 * Formats d'en-tête acceptés :
 *  - `Wave-Signature: t=<horodatage>,v1=<hex>[,v1=<hex>]` : HMAC de
 *    `<horodatage><corps brut>`, horodatage à ±5 min (format Wave) ;
 *  - `X-Signature` / `X-Wave-Signature: <hex>` : HMAC du corps brut.
 * ⚠️ À confirmer avec un vrai webhook de chaque opérateur avant d'activer le
 * paiement en ligne (WAVE_WEBHOOK_SECRET / ORANGE_MONEY_WEBHOOK_SECRET).
 */
const validateWebhookSignature = (provider) => {
  return (req, res, next) => {
    try {
      const entete = req.headers['wave-signature'] || req.headers['x-wave-signature'] || req.headers['x-signature'];
      if (!entete) {
        logger.warn(`Webhook ${provider} rejeté : signature manquante`, { ip: req.ip, provider });
        return res.status(401).json({ error: 'Signature manquante' });
      }

      const secret = provider === 'wave'
        ? process.env.WAVE_WEBHOOK_SECRET
        : process.env.ORANGE_MONEY_WEBHOOK_SECRET;
      if (!secret) {
        logger.error(`Webhook ${provider} : secret manquant en configuration`, { provider });
        return res.status(500).json({ error: 'Configuration manquante' });
      }

      const corps = req.rawBody
        ? req.rawBody.toString('utf8')
        : (typeof req.body === 'string' ? req.body : JSON.stringify(req.body));

      let valide = false;
      const horodatage = /(?:^|,)\s*t=(\d+)/.exec(entete);
      if (horodatage) {
        const t = Number(horodatage[1]);
        const ecart = Math.abs(Date.now() / 1000 - t);
        if (ecart > TOLERANCE_SECONDES) {
          logger.warn(`Webhook ${provider} rejeté : horodatage trop ancien`, { ip: req.ip, provider, ecart_s: Math.round(ecart) });
          return res.status(401).json({ error: 'Signature expirée' });
        }
        const attendue = hmac(secret, `${horodatage[1]}${corps}`);
        const signatures = [...entete.matchAll(/v1=([0-9a-fA-F]+)/g)].map((m) => m[1].toLowerCase());
        valide = signatures.some((sig) => egal(sig, attendue));
      } else {
        valide = egal(String(entete).trim().toLowerCase(), hmac(secret, corps));
      }

      if (!valide) {
        logger.warn(`Webhook ${provider} rejeté : signature invalide`, { ip: req.ip, provider });
        return res.status(401).json({ error: 'Signature invalide' });
      }

      logger.info(`Webhook ${provider} signature valide`, { provider });
      return next();
    } catch (err) {
      logger.error(`Webhook ${provider} erreur validation signature`, { error: err.message, provider });
      return res.status(500).json({ error: 'Erreur validation' });
    }
  };
};

module.exports = validateWebhookSignature;
