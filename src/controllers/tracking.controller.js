const { Colis, Utilisateur, ColisHistorique } = require('../models');
const logger = require('../config/logger');
const { suiviPublicHtml, suiviIntrouvableHtml } = require('../pdf/suiviPublic.template');

/**
 * Masque un numéro de téléphone : affiche les 2 premiers et 2 derniers chiffres.
 * Ex: "0612345678" → "06****78"
 */
function masquerTelephone(tel) {
  if (!tel) return null;
  const cleaned = tel.replace(/\s/g, '');
  if (cleaned.length <= 4) return '****';
  return cleaned.slice(0, 2) + '****' + cleaned.slice(-2);
}

/**
 * GET /nanei/suivi/:reference
 * Suivi public d'un colis — sans authentification, sans données personnelles
 * complètes. Renvoie une page HTML (scan QR code de l'étiquette, lien
 * partagé — voir suiviPublic dans etiquette.template.js) par défaut ; le
 * JSON reste disponible explicitement via ?format=json pour un usage API.
 */
exports.suivrePublic = async (req, res) => {
  const { reference } = req.params;
  const veutJson = req.query.format === 'json';

  try {
    const colis = await Colis.findOne({
      where: { reference },
      include: [
        {
          model: Utilisateur,
          as: 'expediteur',
          attributes: ['nom', 'prenom', 'telephone', 'adresse'],
        },
        {
          model: Utilisateur,
          as: 'recepteur',
          attributes: ['nom', 'prenom', 'telephone'],
        },
        {
          model: ColisHistorique,
          as: 'historique',
          attributes: ['ancien_statut', 'nouveau_statut', 'commentaire', 'created_at'],
          order: [['created_at', 'ASC']],
        },
      ],
    });

    if (!colis) {
      if (veutJson) {
        return res.status(404).json({ success: false, message: 'Colis introuvable' });
      }
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(404).send(suiviIntrouvableHtml(reference));
    }

    // Construire la réponse publique sans données personnelles sensibles
    const expediteur = colis.expediteur
      ? {
          nom: colis.expediteur.nom,
          prenom: colis.expediteur.prenom,
          telephone: masquerTelephone(colis.expediteur.telephone),
        }
      : null;

    const recepteur = colis.recepteur
      ? {
          nom: colis.recepteur.nom,
          prenom: colis.recepteur.prenom,
          telephone: masquerTelephone(colis.recepteur.telephone),
        }
      : null;

    const colisData = {
      reference: colis.reference,
      statut: colis.statut,
      destination: colis.destination,
      poids: colis.poids,
      type_colis: colis.type_colis,
      created_at: colis.createdAt,
      expediteur,
      recepteur,
      historique: colis.historique || [],
    };

    if (veutJson) {
      return res.status(200).json({ success: true, colis: colisData });
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(suiviPublicHtml(colisData));

  } catch (err) {
    logger.error('Erreur dans suivrePublic', { error: err.message, stack: err.stack });
    if (veutJson) {
      return res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(500).send(suiviIntrouvableHtml(reference));
  }
};
