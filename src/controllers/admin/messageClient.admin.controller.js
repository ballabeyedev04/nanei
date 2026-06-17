const service = require('../../services/admin/messageClient.admin.service');

exports.getNombreMessages = async (req, res) => {
  try {
    const result = await service.getNombreMessages();
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erreur serveur.', error: error.message });
  }
};

exports.getTousMessages = async (req, res) => {
  try {
    const result = await service.getTousMessages();
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Erreur serveur.', error: error.message });
  }
};

exports.repondreMessage = async (req, res) => {
  try {
    const { reponse } = req.body;
    if (!reponse || !reponse.trim()) {
      return res.status(400).json({ success: false, message: 'La réponse est requise.' });
    }
    const result = await service.repondreMessage(req.params.id, reponse.trim());
    return res.status(200).json({ ...result, message: 'Réponse envoyée avec succès.' });
  } catch (error) {
    const status = error.message === 'Message introuvable' ? 404 : 500;
    return res.status(status).json({ success: false, message: error.message || 'Erreur serveur.' });
  }
};
