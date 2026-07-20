const Colis = require('../../models/colis.model');
const logger = require('../../config/logger');
const Utilisateur = require('../../models/utilisateur.model');
const Country = require('../../models/country.model');
const { genererEtiquette } = require('../../pdf/etiquette.template');
const { genererEtiquetteZPL } = require('../../pdf/etiquette.zpl');

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

    if (colis.expediteurId !== userId) {
      return res.status(403).json({ success: false, message: 'Accès non autorisé' });
    }

    const colisData = {
      reference: colis.reference,
      expediteurNom: colis.expediteur?.nom || '',
      expediteurPrenom: colis.expediteur?.prenom || '',
      expediteurTelephone: colis.expediteur?.telephone || '',
      expediteurEmail: colis.expediteur?.email || '',
      // Nanei/FrancoMaliShip expédie depuis le Mali — pas de champ pays
      // dédié sur l'expéditeur, l'origine est fixe pour tous les colis.
      expediteurPays: 'MALI',
      recepteurNom: colis.recepteur?.nom || '',
      recepteurPrenom: colis.recepteur?.prenom || '',
      recepteurTelephone: colis.recepteur?.telephone || '',
      recepteurEmail: colis.recepteur?.email || '',
      recepteurPays: colis.destination || '',
      typeTransport: colis.type_colis || 'aerien',
      poids: colis.poids,
      // Modèle en underscored: true — l'attribut JS reste createdAt (camelCase),
      // seul le nom de colonne SQL est created_at. `colis.created_at` valait
      // toujours undefined, d'où "Créé le —" systématique sur l'étiquette.
      createdAt: colis.createdAt,
    };

    // ?format=zpl — flux ZPL brut pour imprimante thermique (100x150mm),
    // à défaut le PDF classique (visualisation écran / impression bureau).
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
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Cache-Control', 'no-cache');
    return res.end(buffer);

  } catch (err) {
    logger.error('Erreur dans genererEtiquetteClient', { error: err.message, stack: err.stack, user_id: req.user?.id });
    return res.status(500).json({ success: false, message: err.message || 'Erreur génération étiquette' });
  }
};
