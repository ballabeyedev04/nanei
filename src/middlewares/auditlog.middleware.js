const AuditLog = require('../models/auditlog.model');
const logger = require('../config/logger');

/**
 * Factory middleware d'audit.
 * Usage : router.post('/...', auth, isAdmin, auditLog('CREATE', 'Colis'), controller.fn)
 *
 * @param {string} action - Action effectuée (ex: CREATE, UPDATE, DELETE)
 * @param {string} entite - Entité concernée (ex: Colis, Utilisateur, Paiement)
 * @returns {Function} Middleware Express
 */
function auditLog(action, entite) {
  return (req, res, next) => {
    // Enregistrer après la réponse
    res.on('finish', async () => {
      try {
        // On n'enregistre que les opérations qui ont réussi (2xx ou 3xx)
        if (res.statusCode >= 400) return;

        const adminId = req.user?.id || null;
        const entiteId =
          req.params?.id ||
          req.params?.colisId ||
          req.params?.userId ||
          null;

        const ip = req.ip || req.headers['x-forwarded-for'] || null;

        await AuditLog.create({
          admin_id: adminId,
          action,
          entite,
          entite_id: entiteId ? String(entiteId) : null,
          details: {
            method: req.method,
            path: req.originalUrl,
            body: req.method !== 'GET' ? req.body : undefined,
          },
          ip_address: ip ? String(ip).split(',')[0].trim() : null,
        });
      } catch (err) {
        logger.warn('AuditLog erreur enregistrement', { error: err.message });
      }
    });

    next();
  };
}

module.exports = auditLog;
