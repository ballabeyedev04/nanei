'use strict';

/**
 * Base JETABLE des tests d'intégration (PostgreSQL réel).
 *
 * Activés seulement si NANEI_TEST_DB_NAME est défini ; sinon chaque fichier
 * d'intégration se déclare sauté (describe.skip) : `npm test` reste vert sans
 * base, en local comme en CI.
 *
 * Garde-fou : le nom de la base doit contenir « test », « jetable » ou « ci » —
 * les tables y sont RECRÉÉES (`sync({ force: true })`). Jamais la base de
 * production par erreur d'une variable mal copiée.
 *
 * Variables : NANEI_TEST_DB_NAME (obligatoire), NANEI_TEST_DB_HOST (127.0.0.1),
 * NANEI_TEST_DB_PORT (5432), NANEI_TEST_DB_USER (postgres),
 * NANEI_TEST_DB_PASSWORD ('').
 */

function configurerBaseIntegration() {
  const nom = process.env.NANEI_TEST_DB_NAME;
  if (!nom) return false;
  if (!/test|jetable|ci/i.test(nom)) {
    throw new Error(`NANEI_TEST_DB_NAME="${nom}" : le nom doit contenir « test », « jetable » ou « ci » (la base est vidée).`);
  }
  process.env.DB_NAME = nom;
  process.env.DB_HOST = process.env.NANEI_TEST_DB_HOST || '127.0.0.1';
  process.env.DB_PORT = process.env.NANEI_TEST_DB_PORT || '5432';
  process.env.DB_USER = process.env.NANEI_TEST_DB_USER || 'postgres';
  process.env.DB_PASSWORD = process.env.NANEI_TEST_DB_PASSWORD || '';
  process.env.DB_SSL_CA = '';
  return true;
}

module.exports = { configurerBaseIntegration };
