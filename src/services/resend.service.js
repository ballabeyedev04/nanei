const { Resend } = require('resend');
const logger = require('../config/logger');

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = process.env.MAIL_FROM || 'nanei <onboarding@resend.dev>';
const isProd = process.env.NODE_ENV === 'production';

/**
 * Envoi générique — utilisé par tous les autres helpers.
 */
async function sendEmail({ to, subject, html }) {
  const { data, error } = await resend.emails.send({ from: FROM, to, subject, html });

  if (error) {
    logger.error('Resend erreur envoi email', { error: error.message });
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
