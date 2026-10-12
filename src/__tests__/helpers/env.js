'use strict';

/**
 * Environnement de TOUS les tests (setupFiles de jest.config.js).
 *
 * - Secrets JWT de test, tous différents (config/security.js refuse de se
 *   charger sinon — c'est voulu : un secret absent bloque le démarrage).
 * - Aucun identifiant de service externe : même si une doublure manquait, le
 *   service réel échouerait localement au lieu de partir sur le réseau.
 * - Rapports mensuels écrits dans un dossier temporaire jetable.
 *
 * dotenv (appelé par plusieurs modules) ne remplace jamais une variable déjà
 * définie : ces valeurs priment sur un éventuel fichier .env local.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.NODE_ENV = 'test';
process.env.DOTENV_CONFIG_QUIET = 'true'; // dotenv 17 : pas de bandeau à chaque chargement
process.env.JWT_SECRET = 'test-jwt-secret-acces-0123456789';
process.env.JWT_REFRESH_SECRET = 'test-jwt-secret-refresh-0123456789';
process.env.JWT_RESET_SECRET = 'test-jwt-secret-reset-0123456789';
process.env.JWT_EXPIRES_IN = '1h';

for (const cle of [
  'RESEND_API_KEY', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER',
  'ORANGE_SMS_CLIENT_ID', 'ORANGE_SMS_CLIENT_SECRET',
  'R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME',
  'WAVE_API_KEY', 'OM_CLIENT_ID', 'OM_CLIENT_SECRET', 'OM_MERCHANT_KEY',
  'FIREBASE_SERVICE_ACCOUNT_JSON', 'EMAIL_ADMIN', 'FRONTEND_URL', 'PRIX_SERVEUR_OBLIGATOIRE',
]) {
  process.env[cle] = '';
}
process.env.R2_PUBLIC_URL = 'https://r2.test';
process.env.WAVE_WEBHOOK_SECRET = 'secret-webhook-wave-test';
process.env.ORANGE_MONEY_WEBHOOK_SECRET = 'secret-webhook-om-test';
process.env.BACKEND_URL = 'https://api.nanei.test';
process.env.CORS_ORIGIN = 'https://admin.nanei.test';

if (!process.env.RAPPORTS_DIR) {
  process.env.RAPPORTS_DIR = path.join(os.tmpdir(), 'nanei-tests-rapports');
  fs.mkdirSync(process.env.RAPPORTS_DIR, { recursive: true });
}
