const dotenv = require('dotenv');
dotenv.config();
const logger = require('../config/logger');

// Cache pour stocker le token OAuth et éviter de le re-demander à chaque SMS (limite Orange de 50 requêtes/min)
let cachedToken = null;
let tokenExpiresAt = null;

/**
 * Récupère un token d'accès OAuth 2.0 valide auprès de l'API Orange
 */
async function getOrangeAccessToken() {
  const clientId = process.env.ORANGE_SMS_CLIENT_ID;
  const clientSecret = process.env.ORANGE_SMS_CLIENT_SECRET;

  // Si les identifiants sont manquants ou toujours par défaut, on ne tente pas l'appel
  if (!clientId || !clientSecret || clientId === 'votre_client_id_ici' || clientSecret === 'votre_client_secret_ici') {
    throw new Error("Les identifiants Orange SMS API ne sont pas configurés dans le fichier .env");
  }

  // Vérifier si le token en cache est toujours valide (avec une marge de sécurité de 60 secondes)
  const now = Date.now();
  if (cachedToken && tokenExpiresAt && now < tokenExpiresAt - 60000) {
    return cachedToken;
  }

  logger.debug('Orange SMS API : Demande nouveau token');

  // Encodage Base64 des identifiants (client_id:client_secret)
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await fetch('https://api.orange.com/oauth/v3/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json'
    },
    body: 'grant_type=client_credentials'
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Erreur authentification Orange (${response.status}): ${errorText}`);
  }

  const data = await response.json();

  if (!data.access_token) {
    throw new Error("Aucun access_token retourné par l'API Orange");
  }

  cachedToken = data.access_token;
  // Durée de vie du token (souvent 3600 secondes = 1 heure)
  const expiresInMs = parseInt(data.expires_in || '3600', 10) * 1000;
  tokenExpiresAt = Date.now() + expiresInMs;

  logger.info('Orange SMS API : Nouveau token obtenu');
  return cachedToken;
}

/**
 * Formate un numéro de téléphone au format strict requis par Orange: tel:+XXXXXXXXXXX
 */
function formatPhoneNumber(phone) {
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

  return `tel:${cleaned}`;
}

/**
 * Envoie un SMS via l'API Orange Developer
 * @param {string} to - Numéro de téléphone du destinataire (ex: +221773444444)
 * @param {string} message - Contenu du message SMS
 */
async function sendSMS(to, message) {
  try {
    const senderNumber = process.env.ORANGE_SMS_SENDER_NUMBER;
    if (!senderNumber || senderNumber === '+221770000000') {
      throw new Error("Le numéro expéditeur (ORANGE_SMS_SENDER_NUMBER) n'est pas configuré dans le fichier .env");
    }

    const formattedTo = formatPhoneNumber(to);
    const formattedFrom = formatPhoneNumber(senderNumber);

    if (!formattedTo) {
      throw new Error(`Numéro de destinataire invalide : ${to}`);
    }

    // Récupérer le token d'accès
    const accessToken = await getOrangeAccessToken();

    // URL-encoder le senderAddress pour l'URI
    const encodedSenderAddress = encodeURIComponent(formattedFrom);
    const url = `https://api.orange.com/smsmessaging/v1/outbound/${encodedSenderAddress}/requests`;

    const requestBody = {
      outboundSMSMessageRequest: {
        address: formattedTo,
        senderAddress: formattedFrom,
        outboundSMSTextMessage: {
          message: message
        }
      }
    };

    const telMasque = to ? to.slice(0, 4) + '****' + to.slice(-2) : '[inconnu]';
    logger.debug('Orange SMS API : Envoi message', { tel: telMasque });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erreur lors de l'envoi du SMS (${response.status}): ${errorText}`);
    }

    const responseData = await response.json();
    logger.info('SMS envoyé avec succès', { tel: to ? to.slice(0, 4) + '****' + to.slice(-2) : '[inconnu]' });
    return { success: true, data: responseData };

  } catch (error) {
    logger.error('Orange SMS API erreur', { error: error.message });
    return { success: false, error: error.message };
  }
}

module.exports = {
  sendSMS,
  formatPhoneNumber
};
