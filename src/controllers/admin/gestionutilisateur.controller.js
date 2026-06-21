const GestionUtilisateurService = require('../../services/admin/gestionutilisateur.service');
const logger = require('../../config/logger');


// 🔹 Lister utilisateurs particuliers
exports.listeUtilisateur = async (req, res) => {
  try {
    const utilisateurs = await GestionUtilisateurService.listeUtilisateur();

    return res.status(200).json({
      success: true,
      total: utilisateurs.length,
      data: utilisateurs
    });

  } catch (error) {
    logger.error('Erreur dans listeUtilisateur', { error: error.message, stack: error.stack, user_id: req.user?.id });

    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


// 🔹 Activer utilisateur
exports.activerUtilisateur = async (req, res) => {
  try {
    const { id } = req.params;

    const utilisateur = await GestionUtilisateurService.activerUtilisateur({ id });

    return res.status(200).json({
      success: true,
      message: "Utilisateur activé avec succès",
      data: utilisateur
    });

  } catch (error) {
    logger.error('Erreur dans activerUtilisateur', { error: error.message, stack: error.stack, user_id: req.user?.id });

    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
};


// 🔹 Désactiver utilisateur
exports.desactiverUtilisateur = async (req, res) => {
  try {
    const { id } = req.params;

    const utilisateur = await GestionUtilisateurService.desactiverUtilisateur({ id });

    return res.status(200).json({
      success: true,
      message: "Utilisateur désactivé avec succès",
      data: utilisateur
    });

  } catch (error) {
    logger.error('Erreur dans desactiverUtilisateur', { error: error.message, stack: error.stack, user_id: req.user?.id });

    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
};


// 🔹 nombre utilisateurs particuliers
exports.nombreUtilisateursParticuliers = async (req, res) => {
  try {
    const total = await GestionUtilisateurService.nombreUtilisateursParticuliers();

    return res.status(200).json({
      success: true,
      total
    });

  } catch (error) {
    logger.error('Erreur dans nombreUtilisateursParticuliers', { error: error.message, stack: error.stack, user_id: req.user?.id });

    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

//hello world
exports.hello = async (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Hello World!"
  });
};

//rechercher utilisateur
exports.rechercherUtilisateur = async (req, res) => {
  try {
    const { nom, prenom, email } = req.query;

    const utilisateur = await GestionUtilisateurService.rechercherUtilisateur({ nom, prenom, email });

    return res.status(200).json({
      success: true,
      data: utilisateur
    });

  } catch (error) {
    logger.error('Erreur dans rechercherUtilisateur', { error: error.message, stack: error.stack, user_id: req.user?.id });

    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};