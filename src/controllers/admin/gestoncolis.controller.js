const GestionColisService = require('../../services/admin/gestioncolis.service');

// 🔹 Liste colis envoyés
exports.listeColisEnvoyes = async (req, res) => {
  try {
    const colis = await GestionColisService.listeColisEnvoyes();
    res.status(200).json(colis);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 🔹 Liste colis en attente
exports.listeColisEnAttente = async (req, res) => {
  try {
    const colis = await GestionColisService.listeColisEnAttente();
    res.status(200).json(colis);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 🔹 Nombre total colis
exports.nombreColis = async (req, res) => {
  try {
    const total = await GestionColisService.nombreColis();
    res.status(200).json({ total });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 🔹 Nombre par statut (bonus)
exports.nombreParStatut = async (req, res) => {
  try {
    const stats = await GestionColisService.nombreParStatut();
    res.status(200).json(stats);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
