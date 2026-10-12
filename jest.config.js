'use strict';

/**
 * Configuration Jest — avant cette suite, le back n'avait AUCUN test
 * (`"test": "echo Error…"`). Chaque fichier de `src/__tests__/` dit, dans son
 * commentaire d'en-tête, quel défaut il rend impossible.
 *
 * - `helpers/env.js` (setupFiles) : variables d'environnement de test (secrets
 *   JWT, aucun identifiant de service externe, dossier de rapports jetable).
 * - `helpers/doublures.js` (setupFilesAfterEnv) : TOUS les services qui
 *   sortent du processus (Resend, Twilio / Orange SMS, R2, Firebase, Wave,
 *   Orange Money, Chromium, cron) sont doublés pour chaque fichier de test.
 *   Aucun test ne fait d'appel réseau réel ; aucune base réelle n'est ouverte
 *   hors du dossier `integration/` (sauté sans base jetable, voir README).
 */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/src/__tests__/**/*.test.js'],
  setupFiles: ['<rootDir>/src/__tests__/helpers/env.js'],
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/helpers/doublures.js'],
  clearMocks: true,
  restoreMocks: true,
  testTimeout: 20000,
};
