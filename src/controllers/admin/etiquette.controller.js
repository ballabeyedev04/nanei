const Colis = require('../../models/colis.model');
const logger = require('../../config/logger');
const Utilisateur = require('../../models/utilisateur.model');
const { genererEtiquette } = require('../../pdf/etiquette.template');
const { genererEtiquetteZPL } = require('../../pdf/etiquette.zpl');

/**
 * GET /nanei/admin/etiquettes/:colisId
 * Génère et retourne le PDF de l'étiquette d'un colis, pour l'admin —
 * pas de vérification de propriétaire (contrairement à la version client),
 * un admin peut télécharger l'étiquette de n'importe quel colis.
 */
exports.genererEtiquetteAdmin = async (req, res) => {
  try {
    const { colisId } = req.params;

    const colis = await Colis.findByPk(colisId, {
      include: [
        {
          model: Utilisateur,
          as: 'expediteur',
          attributes: ['id', 'nom', 'prenom', 'telephone', 'email', 'adresse'],
        },
        {
          model: Utilisateur,
          as: 'recepteur',
          attributes: ['nom', 'prenom', 'telephone', 'email', 'adresse'],
        },
      ],
    });

    if (!colis) {
      return res.status(404).json({ success: false, message: 'Colis introuvable' });
    }

    const colisData = {
      reference: colis.reference,
      expediteurNom: colis.expediteur?.nom || '',
      expediteurPrenom: colis.expediteur?.prenom || '',
      expediteurTelephone: colis.expediteur?.telephone || '',
      expediteurEmail: colis.expediteur?.email || '',
      expediteurPays: 'MALI',
      recepteurNom: colis.recepteur?.nom || '',
      recepteurPrenom: colis.recepteur?.prenom || '',
      recepteurTelephone: colis.recepteur?.telephone || '',
      recepteurEmail: colis.recepteur?.email || '',
      recepteurPays: colis.destination || '',
      typeTransport: colis.type_colis || 'aerien',
      poids: colis.poids,
      createdAt: colis.createdAt,
    };

    // ?format=zpl — flux ZPL brut pour imprimante thermique (100x150mm),
    // utile pour les admins qui impriment directement au point de collecte.
    if (req.query.format === 'zpl') {
      const zpl = genererEtiquetteZPL(colisData);
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="etiquette-${colis.reference}.zpl"`);
      res.setHeader('Cache-Control', 'no-cache');
      return res.end(zpl);
    }

    const buffer = await genererEtiquette(colisData);
    const filename = `etiquette-${colis.reference}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Cache-Control', 'no-cache');
    return res.end(buffer);

  } catch (err) {
    logger.error('Erreur dans genererEtiquetteAdmin', { error: err.message, stack: err.stack, user_id: req.user?.id });
    return res.status(500).json({ success: false, message: err.message || 'Erreur génération étiquette' });
  }
};
