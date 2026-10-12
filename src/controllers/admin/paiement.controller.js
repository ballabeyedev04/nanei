const AdminPaiementService = require('../../services/admin/paiement.service');
const logger = require('../../config/logger');

exports.listePaiements = async (req, res) => {
  try {
    const result = await AdminPaiementService.listePaiements(req.query);
    if (!result.success) { const { status = 400, ...corps } = result; return res.status(status).json(corps); }
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erreur serveur', error: err.message });
  }
};

exports.changerStatut = async (req, res) => {
  try {
    const result = await AdminPaiementService.changerStatut(req.params.id, req.body.statut);
    if (!result.success) { const { status = 400, ...corps } = result; return res.status(status).json(corps); }
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
