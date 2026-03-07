const EnvoieColisService = require('../../services/client/envoieColis.service');

// Contrôleur existant (envoi de colis)
exports.envoieColisController = async (req, res) => {
  const { recepteurId, poids, prix, destination, description, type_colis } = req.body;
  const utilisateurConnecte = req.user;

  try {
    const result = await EnvoieColisService.envoieColis({
      recepteurId,
      poids,
      prix,
      utilisateurConnecte,
      destination,
      description,
      type_colis
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
  const searchTerm = req.query.q; 

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

// 🔹 Récupérer les colis envoyés par l'utilisateur connecté
exports.getColisEnvoyesController = async (req, res) => {
  try {
    // req.user est rempli par ton middleware d'auth avec le token décodé
    const utilisateurId = req.user.id;

    const result = await EnvoieColisService.getColisEnvoyes(utilisateurId);

    if (!result.success) {
      return res.status(400).json({ message: result.message });
    }

    return res.status(200).json({ data: result.data });
  } catch (err) {
    console.error('Erreur récupération colis envoyés :', err);
    return res.status(500).json({
      message: 'Erreur serveur lors de la récupération des colis envoyés',
      erreur: err.message
    });
  }
};

// 🔹 Récupérer les colis reçus par l'utilisateur connecté
exports.getColisRecusController = async (req, res) => {
  try {
    const utilisateurId = req.user.id;

    const result = await EnvoieColisService.getColisRecus(utilisateurId);

    if (!result.success) {
      return res.status(400).json({ message: result.message });
    }

    return res.status(200).json({ data: result.data });
  } catch (err) {
    console.error('Erreur récupération colis reçus :', err);
    return res.status(500).json({
      message: 'Erreur serveur lors de la récupération des colis reçus',
      erreur: err.message
    });
  }
};

exports.statistiquesColis= async (req, res) => {
  const utilisateurId = req.user.id;

  const result = await EnvoieColisService.getStatistiquesColis(utilisateurId);

  if (!result.success) {
    return res.status(500).json(result);
  }

  return res.json(result);
}