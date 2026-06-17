const MessageClient = require('../../models/messageClient.model');

exports.getNombreMessages = async () => {
  const total = await MessageClient.count();
  return { success: true, total };
};

exports.getTousMessages = async () => {
  const messages = await MessageClient.findAll({ order: [['createdAt', 'DESC']] });
  return { success: true, data: messages };
};

exports.repondreMessage = async (id, reponse) => {
  const message = await MessageClient.findByPk(id);
  if (!message) throw new Error('Message introuvable');

  const { sendEmail } = require('../resend.service');
  const template = require('../../templates/mail/reponseMessage.template');

  await sendEmail({
    to: message.email,
    subject: `Réponse Nanei — ${message.objet}`,
    html: template({
      objet: message.objet,
      messageOriginal: message.description,
      reponse,
    }),
  });

  return { success: true, destinataire: message.email };
};
