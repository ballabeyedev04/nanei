const messageClientService = require('../services/messageClient.service');

exports.envoyerMessage = async (req, res) => {
  try {
    const { email, objet, description } = req.body;

    if (!email || !objet || !description) {
      return res.status(400).json({
        success: false,
        message: 'Les champs email, objet et description sont obligatoires.',
      });
    }

    const message = await messageClientService.envoyerMessage({ email, objet, description });

    return res.status(201).json({
      success: true,
      message: 'Message envoyé avec succès. Nous vous répondrons via email.',
      data: { id: message.id },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Erreur serveur.',
      error: error.message,
    });
  }
};

exports.getTousMessages = async (req, res) => {
  try {
    const messages = await messageClientService.getTousMessages();
    return res.status(200).json({ success: true, data: messages });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
};

exports.getNombreMessages = async (req, res) => {
  try {
    const result = await messageClientService.getNombreMessages();
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
};

exports.repondreMessage = async (req, res) => {
  try {
    const { reponse } = req.body;
    if (!reponse || !reponse.trim()) {
      return res.status(400).json({ success: false, message: 'La réponse est requise.' });
    }
    const result = await messageClientService.repondreMessage(req.params.id, reponse.trim());
    return res.status(200).json({ success: true, message: 'Réponse envoyée avec succès.', ...result });
  } catch (error) {
    const status = error.message === 'Message introuvable' ? 404 : 500;
    return res.status(status).json({ success: false, message: error.message || 'Erreur serveur.' });
  }
};
