const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_SECURE === 'true', // true pour port 465
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

/**
 * @param {string} to - destinataire
 * @param {string} subject - objet du mail
 * @param {string} html - contenu HTML
 * @param {Array} attachments - pièces jointes (optionnel)
 */
exports.sendEmail = async ({ to, subject, html, attachments = [] }) => {
  await transporter.sendMail({
    from: `"Support" <${process.env.SMTP_USER}>`,
    to,
    subject,
    html,
    attachments
  });
};
