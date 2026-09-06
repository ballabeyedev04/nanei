const { Resend } = require('resend');
const logger = require('../config/logger');

const isProd = process.env.NODE_ENV === 'production';

// Client construit À LA PREMIÈRE UTILISATION, et non au chargement du module.
//
// `new Resend(process.env.RESEND_API_KEY)` s'exécutait à l'import : si la
// variable n'était pas encore lue (ordre des `require`, `.env` absent au
// démarrage du conteneur), le client naissait avec une clé `undefined` et
// TOUS les envois échouaient ensuite, y compris après correction de
// l'environnement — il aurait fallu redémarrer le processus. L'initialisation
// paresseuse lit la variable au moment où on en a réellement besoin.
let resend = null;

function getResend() {
  if (resend) return resend;

  const cle = process.env.RESEND_API_KEY;
  if (!cle) {
    // Message explicite dans les LOGS : sans lui, une clé absente et une clé
    // invalide produisaient le même « Impossible d'envoyer l'email » côté
    // client, sans moyen de les distinguer côté serveur.
    logger.error('RESEND_API_KEY absente — aucun email ne peut être envoyé');
    throw new Error('RESEND_API_KEY non configurée sur le serveur');
  }
  resend = new Resend(cle);
  return resend;
}

/** Expéditeur — lu à chaque envoi, pour la même raison que la clé. */
function getFrom() {
  return process.env.MAIL_FROM || 'nanei <onboarding@resend.dev>';
}

/**
 * Envoi générique — utilisé par tous les autres helpers.
 */
async function sendEmail({ to, subject, html }) {
  const from = getFrom();
  const { data, error } = await getResend().emails.send({ from, to, subject, html });

  if (error) {
    // L'expéditeur est journalisé : la cause la plus fréquente d'un refus est
    // un domaine `from` non vérifié dans Resend, et le message du provider
    // seul (« The domain is not verified ») ne dit pas LEQUEL était utilisé.
    logger.error('Resend erreur envoi email', { error: error.message, from });
    throw new Error(error.message);
  }

  if (isProd) {
    const domain = (Array.isArray(to) ? to[0] : to).split('@')[1] ?? '?';
    logger.info('Email envoyé', { destinataire: `*@${domain}`, sujet: subject });
  } else {
    logger.debug('Email envoyé (dev)', { sujet: subject, id: data?.id });
  }

  return data;
}

/**
 * Email OTP de réinitialisation de mot de passe
 */
async function sendOtpEmail({ to, nom, otp }) {
  const otpTemplate = require('../templates/mail/otpPassword.template');
  return sendEmail({
    to,
    subject: 'Votre code de réinitialisation nanei',
    html: otpTemplate({ nom, otp })
  });
}

module.exports = { sendEmail, sendOtpEmail };
