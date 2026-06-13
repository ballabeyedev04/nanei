const MessageClient = require('../models/messageClient.model');

exports.envoyerMessage = async ({ email, objet, description }) => {
  const message = await MessageClient.create({ email, objet, description });
  return message;
};

exports.getTousMessages = async () => {
  return MessageClient.findAll({ order: [['createdAt', 'DESC']] });
};
