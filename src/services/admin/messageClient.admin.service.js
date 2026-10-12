const MessageClient = require('../../models/messageClient.model');
const { Op } = require('sequelize');
const { paginer, motifRecherche, avecPagination } = require('../../utils/pagination');
const { sujetEmail } = require('../../utils/echapperHtml');

exports.getNombreMessages = async () => {
  const total = await MessageClient.count();
  return { success: true, total };
};

// Query : page, limit (pagination facultative), q (e-mail, objet, message)
exports.getTousMessages = async (query = {}) => {
  const motif = motifRecherche(query.q);
  const where = motif ? { [Op.or]: [
    { email: { [Op.iLike]: motif } },
    { objet: { [Op.iLike]: motif } },
    { description: { [Op.iLike]: motif } },
  ] } : {};
  const { lignes, pagination } = await paginer(MessageClient, { where, order: [['createdAt', 'DESC']] }, query);
  return avecPagination({ success: true, data: lignes }, pagination);
};

exports.repondreMessage = async (id, reponse) => {
  const message = await MessageClient.findByPk(id);
  if (!message) throw new Error('Message introuvable');

  const { sendEmail } = require('../resend.service');
  const template = require('../../templates/mail/reponseMessage.template');

  await sendEmail({
    to: message.email,
    subject: sujetEmail(`Réponse Nanei — ${message.objet}`),
    html: template({
      objet: message.objet,
      messageOriginal: message.description,
      reponse,
    }),
  });

  return { success: true, destinataire: message.email };
};
