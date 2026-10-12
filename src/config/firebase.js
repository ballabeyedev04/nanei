const admin = require('firebase-admin');
const logger = require('./logger');

let firebaseApp = null;

function getFirebase() {
  if (firebaseApp) return firebaseApp;
  try {
    let serviceAccount;
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    } else {
      // Fichier local facultatif (jamais versionné, voir .gitignore) : son
      // absence est prévue et gérée par le catch ci-dessous.
      // eslint-disable-next-line n/no-missing-require, n/no-unpublished-require -- fichier facultatif, absent du dépôt par conception
      serviceAccount = require('./firebase-service-account.json');
    }
    firebaseApp = admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  } catch (e) {
    logger.warn('Firebase non configuré', { error: e.message });
  }
  return firebaseApp;
}

module.exports = { getFirebase, admin };
