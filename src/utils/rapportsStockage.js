const path = require('path');
const fs = require('fs');
const logger = require('../config/logger');

/**
 * Dossier PRIVÉ des rapports mensuels (PDF financiers).
 *
 * Avant : src/uploads/rapports, servi en statique public par app.js
 * (`/uploads/...`) → n'importe qui pouvait télécharger
 * /uploads/rapports/rapport-AAAA-MM.pdf sans jeton. Ce dossier n'était pas
 * non plus sur le volume Docker : les rapports disparaissaient à chaque
 * redéploiement.
 *
 * Maintenant : <racine du projet>/uploads/rapports (/app/uploads/rapports en
 * production, volume `uploads_data`), jamais servi en statique. Seule la
 * route GET /nanei/admin/rapports/:filename (auth + isAdmin) le lit.
 * Surchargeable par la variable RAPPORTS_DIR.
 */
const RAPPORTS_DIR = process.env.RAPPORTS_DIR || path.join(process.cwd(), 'uploads', 'rapports');
const ANCIEN_DIR = path.join(__dirname, '..', 'uploads', 'rapports');

function preparerDossierRapports() {
  fs.mkdirSync(RAPPORTS_DIR, { recursive: true });

  // Reprise des rapports générés à l'ancien emplacement public
  if (path.resolve(ANCIEN_DIR) === path.resolve(RAPPORTS_DIR) || !fs.existsSync(ANCIEN_DIR)) return;
  for (const f of fs.readdirSync(ANCIEN_DIR).filter((n) => n.endsWith('.pdf'))) {
    try {
      const cible = path.join(RAPPORTS_DIR, f);
      if (!fs.existsSync(cible)) fs.copyFileSync(path.join(ANCIEN_DIR, f), cible);
      fs.unlinkSync(path.join(ANCIEN_DIR, f));
    } catch (err) {
      logger.warn('Rapports : déplacement impossible', { fichier: f, error: err.message });
    }
  }
}

module.exports = { RAPPORTS_DIR, preparerDossierRapports };
