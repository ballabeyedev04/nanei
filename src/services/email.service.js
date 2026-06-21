/**
 * Service email générique via nodemailer.
 * Variables env : EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS, EMAIL_FROM
 * Utilisé en complément de resend.service.js pour les envois directs SMTP.
 */
const nodemailer = require('nodemailer');
const logger = require('../config/logger');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const host = process.env.EMAIL_HOST;
  const port = process.env.EMAIL_PORT;
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (!host || !user || !pass) {
    logger.warn('Email: variables ENV manquantes — emails désactivés');
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port: parseInt(port || '587', 10),
    secure: parseInt(port || '587', 10) === 465,
    auth: { user, pass },
  });

  return transporter;
}

/**
 * Envoie un email.
 * @param {string} destinataire - Adresse email du destinataire
 * @param {string} sujet - Sujet de l'email
 * @param {string} html - Corps HTML
 */
async function envoyerEmail(destinataire, sujet, html) {
  const t = getTransporter();
  if (!t) return;

  try {
    const from = process.env.EMAIL_FROM || process.env.EMAIL_USER;
    await t.sendMail({ from, to: destinataire, subject: sujet, html });
    logger.info('Email envoyé', { sujet });
  } catch (err) {
    logger.warn('Email erreur envoi', { error: err.message });
  }
}

module.exports = { envoyerEmail };
