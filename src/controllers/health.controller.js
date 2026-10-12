'use strict';

const sequelize = require('../config/db');
const logger = require('../config/logger');
const { API_VERSION, VERSION } = require('../config/version');

/**
 * GET /health — sonde de santé (Docker HEALTHCHECK, deploy/release.sh,
 * chaîne de déploiement, admin).
 *
 *   200 { status: 'OK', db: 'ok', version: '<sha du commit | dev>', api: <entier> }
 *   503 { status: 'KO', db: 'erreur' }
 *
 * La base est réellement interrogée (`sequelize.authenticate()` = SELECT 1)
 * avec un délai court : un backend dont la base est injoignable n'est PAS en
 * bonne santé, et le déploiement doit le voir (retour arrière automatique).
 *
 * Aucune information technique dans la réponse (ni message d'erreur, ni
 * hôte, ni version de Node / Postgres) : la route est publique. Le détail de
 * l'erreur reste dans les journaux.
 */
const DELAI_BASE_MS = Number(process.env.HEALTH_DB_TIMEOUT_MS) || 3000;

function avecDelai(promesse, ms) {
  let minuteur;
  const delai = new Promise((_, rejeter) => {
    minuteur = setTimeout(() => rejeter(new Error(`base : pas de réponse en ${ms} ms`)), ms);
  });
  return Promise.race([promesse, delai]).finally(() => clearTimeout(minuteur));
}

async function sante(req, res) {
  // Une sonde ne doit jamais être servie depuis un cache (proxy, navigateur).
  res.set('Cache-Control', 'no-store');
  try {
    await avecDelai(sequelize.authenticate({ logging: false }), DELAI_BASE_MS);
  } catch (err) {
    logger.error('[health] base de données injoignable', { error: err.message });
    return res.status(503).json({ status: 'KO', db: 'erreur' });
  }
  return res.status(200).json({ status: 'OK', db: 'ok', version: VERSION, api: API_VERSION });
}

module.exports = { sante };
