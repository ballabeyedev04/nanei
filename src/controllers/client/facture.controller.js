const FactureService = require('../../services/pdf/facture.service');
const Paiement = require('../../models/paiement.model');
const logger = require('../../config/logger');

/**
 * GET /nanei/paiements/:id/facture
 * Affiche la facture PDF en ligne (aperçu dans le navigateur).
 */
exports.afficherFacture = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Vérifier que le paiement appartient à l'utilisateur
    const paiement = await Paiement.findByPk(id);
    if (!paiement) return res.status(404).json({ success: false, message: 'Paiement non trouvé' });
    if (paiement.payeurId !== userId) return res.status(403).json({ success: false, message: 'Accès non autorisé' });
    if (paiement.statut !== 'paye') return res.status(400).json({ success: false, message: 'Facture disponible uniquement après paiement validé' });

    const { buffer, filename } = await FactureService.generer(id);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Cache-Control', 'no-cache');
    return res.end(buffer);

  } catch (err) {
    logger.error('Erreur facture', { error: err.message, stack: err.stack, user_id: req.user?.id });
    return res.status(500).json({ success: false, message: err.message || 'Erreur génération facture' });
  }
};

/**
 * GET /nanei/paiements/:id/facture/download
 * Télécharge la facture PDF (force le téléchargement).
 */
exports.telechargerFacture = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const paiement = await Paiement.findByPk(id);
    if (!paiement) return res.status(404).json({ success: false, message: 'Paiement non trouvé' });
    if (paiement.payeurId !== userId) return res.status(403).json({ success: false, message: 'Accès non autorisé' });
    if (paiement.statut !== 'paye') return res.status(400).json({ success: false, message: 'Facture disponible uniquement après paiement validé' });

    const { buffer, filename } = await FactureService.generer(id);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Cache-Control', 'no-cache');
    return res.end(buffer);

  } catch (err) {
    logger.error('Erreur téléchargement facture', { error: err.message, stack: err.stack, user_id: req.user?.id });
    return res.status(500).json({ success: false, message: err.message || 'Erreur téléchargement facture' });
  }
};
