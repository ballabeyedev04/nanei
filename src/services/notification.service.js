const { getFirebase, admin } = require('../config/firebase');
const logger = require('../config/logger');

/**
 * Envoie une push notification Firebase FCM.
 * @param {string} fcmToken - Token FCM de l'appareil
 * @param {string} titre - Titre de la notification
 * @param {string} corps - Corps du message
 * @param {object} data - Données additionnelles (clés/valeurs string)
 */
async function envoyerPushNotification(fcmToken, titre, corps, data = {}) {
  if (!fcmToken) return;

  const app = getFirebase();
  if (!app) {
    logger.warn('[FCM] Push non envoyé — Firebase non configuré');
    return;
  }

  try {
    const stringData = {};
    Object.keys(data).forEach((k) => { stringData[k] = String(data[k]); });

    await admin.messaging().send({
      token: fcmToken,
      notification: { title: titre, body: corps },
      data: stringData,
    });
    logger.info('Push FCM envoyé', { titre, user_data_keys: Object.keys(data) });
  } catch (err) {
    logger.warn('FCM erreur envoi push', { error: err.message, titre });
  }
}

module.exports = { envoyerPushNotification };
