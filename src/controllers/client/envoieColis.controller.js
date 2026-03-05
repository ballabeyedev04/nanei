const EnvoieColisService = require('../../services/client/envoieColis.service');

// Contrôleur existant (envoi de colis)
exports.envoieColisController = async (req, res) => {
  const { recepteurId, poids, prix, destination } = req.body;
  const utilisateurConnecte = req.user;

  try {
    const result = await EnvoieColisService.envoieColis({
      recepteurId,
      poids,
      prix,
      utilisateurConnecte,
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

// Nouveau contrôleur : recherche de client
exports.rechercherClientController = async (req, res) => {
  const searchTerm = req.query.q; // ex: /api/client/rechercher?q=jean

  try {
    const result = await EnvoieColisService.rechercherClient(searchTerm);

    if (!result.success) {
      return res.status(400).json({
        message: result.message
      });
    }

    return res.status(200).json({
      data: result.data
    });

  } catch (err) {
    console.error('Erreur recherche client :', err);
    return res.status(500).json({
      message: 'Erreur serveur lors de la recherche du client',
      erreur: err.message
    });
  }
};