const EnvoieColisService = require('../../services/client/envoieColis.service');

exports.envoieColisController = async (req, res) => {
  const { recepteurId, poids, prix, destination } = req.body;
  const utilisateurConnecte = req.user;

  try {

    const result = await EnvoieColisService.envoieColis({
      recepteurId,
      poids,
      prix,
      utilisateurConnecte ,
      destination
    });

    if (!result.success) {
      return res.status(400).json({
        message: result.message
      });
    }

    return res.status(201).json({
      message: result.message,
      colis: result.data
    });

  } catch (err) {
    console.error('Erreur envoi colis :', err);

    return res.status(500).json({
      message: 'Erreur serveur lors de l’envoi du colis',
      erreur: err.message
    });
  }
};
