const dotenv = require('dotenv');
dotenv.config();
const twilio = require('twilio');
const logger = require('../config/logger');

/**
 * Formate un numéro de téléphone au format strict E.164 requis par Twilio (ex: +221773444444)
 */
function formatPhoneNumberForTwilio(phone) {
  if (!phone) return null;
  // Nettoyer tous les caractères non numériques, sauf le signe +
  let cleaned = phone.trim().replace(/[^\d+]/g, '');

  // Si le numéro commence par 00, on le remplace par +
  if (cleaned.startsWith('00')) {
    cleaned = '+' + cleaned.substring(2);
  }

  // S'il n'y a pas de +, on assume un format international par défaut (ex: ajouter +221 pour le Sénégal s'il fait 9 chiffres et commence par 7)
  if (!cleaned.startsWith('+')) {
    // Si le numéro fait 9 chiffres et commence par 7, c'est probablement un numéro sénégalais
    if (cleaned.length === 9 && (cleaned.startsWith('77') || cleaned.startsWith('78') || cleaned.startsWith('76') || cleaned.startsWith('70') || cleaned.startsWith('75'))) {
      cleaned = '+221' + cleaned;
    } else {
      cleaned = '+' + cleaned;
    }
  }

  return cleaned;
}

/**
 * Envoie un SMS via l'API Twilio
 * @param {string} to - Numéro de téléphone du destinataire (ex: +221773444444)
 * @param {string} message - Contenu du message SMS
 */
async function sendSMS(to, message) {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !fromNumber || 
        accountSid === 'votre_twilio_account_sid_ici' || 
        authToken === 'votre_twilio_auth_token_ici' || 
        fromNumber === 'votre_twilio_phone_number_ici') {
      throw new Error("Les identifiants Twilio ne sont pas configurés dans le fichier .env");
    }

    const formattedTo = formatPhoneNumberForTwilio(to);
    if (!formattedTo) {
      throw new Error(`Numéro de destinataire invalide : ${to}`);
    }

    logger.debug('Twilio SMS: envoi en cours');

    const client = twilio(accountSid, authToken);

    const response = await client.messages.create({
      body: message,
      from: fromNumber,
      to: formattedTo
    });

    logger.info('Twilio SMS envoyé', { sid: response.sid });
    return { success: true, sid: response.sid };

  } catch (error) {
    logger.error('Twilio SMS erreur', { error: error.message });
    return { success: false, error: error.message };
  }
}

module.exports = {
  sendSMS,
  formatPhoneNumberForTwilio
};
