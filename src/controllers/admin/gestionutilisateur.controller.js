const GestionUtilisateurService = require('../../services/admin/gestionutilisateur.service');


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
    console.error('Erreur liste utilisateurs:', error);

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
    console.error('Erreur activation utilisateur:', error);

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
    console.error('Erreur désactivation utilisateur:', error);

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
    console.error('Erreur comptage utilisateurs :', error);

    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
