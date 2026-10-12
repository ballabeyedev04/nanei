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
// Champs jamais enregistrés en clair dans le journal (lisible par tous les
// admins) : mots de passe, jetons, codes OTP, secrets.
const CLE_SENSIBLE = /pass|mot_de_passe|token|otp|secret|code_?verif|cvv|pin$/i;

/** Copie de `valeur` où chaque champ sensible est remplacé par « *** ». */
function masquerChampsSensibles(valeur, profondeur = 0) {
  if (valeur === null || typeof valeur !== 'object' || profondeur > 5) return valeur;
  if (Array.isArray(valeur)) return valeur.map((v) => masquerChampsSensibles(v, profondeur + 1));
  const copie = {};
  for (const [cle, v] of Object.entries(valeur)) {
    copie[cle] = CLE_SENSIBLE.test(cle) ? '***' : masquerChampsSensibles(v, profondeur + 1);
  }
  return copie;
}

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
            body: req.method !== 'GET' ? masquerChampsSensibles(req.body) : undefined,
            query: req.method === 'GET' && Object.keys(req.query || {}).length ? masquerChampsSensibles(req.query) : undefined,
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
module.exports.masquerChampsSensibles = masquerChampsSensibles;
module.exports.CLE_SENSIBLE = CLE_SENSIBLE;
