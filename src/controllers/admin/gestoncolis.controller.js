const GestionColisService = require('../../services/admin/gestioncolis.service');

/* ===================== LISTE TOUS LES COLIS ===================== */
exports.listeTousLesColis = async (req, res) => {
  try {
    const result = await GestionColisService.listeTousLesColis();

    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Erreur serveur lors de la récupération des colis",
      error: error.message
    });
  }
};


/* ===================== NOMBRE COLIS ===================== */
exports.nombreColis = async (req, res) => {
  try {
    const result = await GestionColisService.nombreColis();
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Erreur serveur comptage colis",
      error: error.message
    });
  }
};


/* ===================== COLIS EN ATTENTE ===================== */
exports.listeColisEnAttente = async (req, res) => {
  try {
    const result = await GestionColisService.listeColisEnAttente();
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Erreur serveur colis en attente",
      error: error.message
    });
  }
};


/* ===================== NOMBRE EN ATTENTE ===================== */
exports.nombreColisEnAttente = async (req, res) => {
  try {
    const result = await GestionColisService.nombreColisEnAttente();
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Erreur serveur comptage en attente",
      error: error.message
    });
  }
};


/* ===================== COLIS LIVRÉS ===================== */
exports.listeColisLivres = async (req, res) => {
  try {
    const result = await GestionColisService.listeColisLivres();
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Erreur serveur colis livrés",
      error: error.message
    });
  }
};


/* ===================== NOMBRE LIVRÉS ===================== */
exports.nombreColisLivres = async (req, res) => {
  try {
    const result = await GestionColisService.nombreColisLivres();
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Erreur serveur comptage livrés",
      error: error.message
    });
  }
};


/* ===================== COLIS RÉCUPÉRÉS ===================== */
exports.listeColisRecuperes = async (req, res) => {
  try {
    const result = await GestionColisService.listeColisRecuperes();
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Erreur serveur colis récupérés",
      error: error.message
    });
  }
};


/* ===================== NOMBRE RÉCUPÉRÉS ===================== */
exports.nombreColisRecuperes = async (req, res) => {
  try {
    const result = await GestionColisService.nombreColisRecuperes();
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Erreur serveur comptage récupérés",
      error: error.message
    });
  }
};


/* ===================== RECHERCHE COLIS ===================== */
exports.rechercherColis = async (req, res) => {
  try {
    const { reference } = req.params;

    const result = await GestionColisService.rechercherColis(reference);

    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Erreur serveur recherche colis",
      error: error.message
    });
  }
};

/* ===================== EN ATTENTE ===================== */
exports.changerEnAttente = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await GestionColisService.changerEnAttente(id);

    if (!result.success) {
      return res.status(404).json(result);
    }

    return res.status(200).json(result);

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Erreur changement statut en attente",
      error: error.message
    });
  }
};


/* ===================== LIVRÉ ===================== */
exports.changerEnLivre = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await GestionColisService.changerEnLivre(id);

    if (!result.success) {
      return res.status(404).json(result);
    }

    return res.status(200).json(result);

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Erreur changement statut livré",
      error: error.message
    });
  }
};


/* ===================== RÉCUPÉRÉ ===================== */
exports.changerEnRecupere = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await GestionColisService.changerEnRecupere(id);

    if (!result.success) {
      return res.status(404).json(result);
    }

    return res.status(200).json(result);

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Erreur changement statut récupéré",
      error: error.message
    });
  }
};