const Colis = require('../../models/colis.model');
const logger = require('../../config/logger');
const Utilisateur = require('../../models/utilisateur.model');
const Country = require('../../models/country.model');
const { genererEtiquette } = require('../../pdf/etiquette.template');

/**
 * GET /nanei/etiquettes/:colisId
 * Génère et retourne le PDF de l'étiquette d'un colis.
 * Accessible uniquement par l'expéditeur du colis.
 */
exports.genererEtiquetteClient = async (req, res) => {
  try {
    const { colisId } = req.params;
    const userId = req.user.id;

    const colis = await Colis.findByPk(colisId, {
      include: [
        {
          model: Utilisateur,
          as: 'expediteur',
          attributes: ['id', 'nom', 'prenom', 'telephone', 'adresse'],
        },
        {
          model: Utilisateur,
          as: 'recepteur',
          attributes: ['nom', 'prenom', 'telephone', 'adresse'],
        },
      ],
    });

    if (!colis) {
      return res.status(404).json({ success: false, message: 'Colis introuvable' });
    }

    if (colis.expediteurId !== userId) {
      return res.status(403).json({ success: false, message: 'Accès non autorisé' });
    }

    const colisData = {
      reference: colis.reference,
      expediteurNom: colis.expediteur?.nom || '',
      expediteurPrenom: colis.expediteur?.prenom || '',
      expediteurTelephone: colis.expediteur?.telephone || '',
      expediteurVille: colis.expediteur?.adresse || '',
      recepteurNom: colis.recepteur?.nom || '',
      recepteurPrenom: colis.recepteur?.prenom || '',
      recepteurTelephone: colis.recepteur?.telephone || '',
      recepteurVille: colis.recepteur?.adresse || '',
      recepteurPays: colis.destination || '',
      typeTransport: colis.type_colis || 'aerien',
      poids: colis.poids,
      createdAt: colis.created_at,
    };

    const buffer = await genererEtiquette(colisData);
    const filename = `etiquette-${colis.reference}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Cache-Control', 'no-cache');
    return res.end(buffer);

  } catch (err) {
    logger.error('Erreur dans genererEtiquetteClient', { error: err.message, stack: err.stack, user_id: req.user?.id });
    return res.status(500).json({ success: false, message: err.message || 'Erreur génération étiquette' });
  }
};
