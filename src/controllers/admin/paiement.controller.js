const AdminPaiementService = require('../../services/admin/paiement.service');
const logger = require('../../config/logger');

exports.listePaiements = async (req, res) => {
  try {
    const result = await AdminPaiementService.listePaiements();
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erreur serveur', error: err.message });
  }
};

exports.changerStatut = async (req, res) => {
  try {
    const result = await AdminPaiementService.changerStatut(req.params.id, req.body.statut);
    if (!result.success) return res.status(400).json(result);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erreur serveur', error: err.message });
  }
};

exports.statistiques = async (req, res) => {
  try {
    const result = await AdminPaiementService.statistiques();
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erreur serveur', error: err.message });
  }
};
