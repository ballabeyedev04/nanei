const EnvoieColisService = require('../../services/client/envoieColis.service');
const logger = require('../../config/logger');
const Country = require('../../models/country.model');
const ShippingPrice = require('../../models/shippingPrice.model');
const ServicePrice = require('../../models/servicePrice.model');
const ShippingRateService = require('../../services/shippingRate.service');
const ServiceRateService = require('../../services/serviceRate.service');

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

    logger.info('Colis créé', { colis_id: result.data?.id, user_id: utilisateurConnecte?.id, destination });
    return res.status(201).json({
      message: result.message,
      colis: result.data
    });

  } catch (err) {
    logger.error('Erreur dans envoieColisController', { error: err.message, stack: err.stack, user_id: req.user?.id });
    return res.status(500).json({
      message: "Erreur serveur lors de l'envoi du colis",
      erreur: err.message
    });
  }
};

// 🔹 Envoyer plusieurs colis en une seule commande groupée (regroupement)
exports.envoieColisLotController = async (req, res) => {
  const { colis } = req.body;
  const utilisateurConnecte = req.user;

  try {
    const result = await EnvoieColisService.envoieColisLot({
      items: colis,
      utilisateurConnecte,
    });

    if (!result.success) {
      return res.status(400).json({ message: result.message });
    }

    logger.info('Lot de colis créé', {
      lot_id: result.data?.lotId,
      nb_colis: result.data?.colis?.length,
      user_id: utilisateurConnecte?.id,
    });

    return res.status(201).json({
      message: result.message,
      lotId: result.data.lotId,
      colis: result.data.colis,
    });

  } catch (err) {
    logger.error('Erreur dans envoieColisLotController', { error: err.message, stack: err.stack, user_id: req.user?.id });
    return res.status(500).json({
      message: "Erreur serveur lors de l'envoi du lot de colis",
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
    logger.error('Erreur dans rechercherClientController', { error: err.message, stack: err.stack, user_id: req.user?.id });
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
    logger.error('Erreur dans getColisEnvoyesController', { error: err.message, stack: err.stack, user_id: req.user?.id });
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
    logger.error('Erreur dans getColisRecusController', { error: err.message, stack: err.stack, user_id: req.user?.id });
    return res.status(500).json({
      message: 'Erreur serveur lors de la récupération des colis reçus',
      erreur: err.message
    });
  }
};

// 🔹 Rechercher un colis par référence (scan QR code) — expéditeur ou destinataire uniquement
exports.rechercherColisParReferenceController = async (req, res) => {
  try {
    const { reference } = req.params;
    const utilisateurId = req.user.id;

    const result = await EnvoieColisService.rechercherColisParReference(reference, utilisateurId);

    if (!result.success) {
      const status = result.message === 'Colis introuvable' ? 404 : 403;
      return res.status(status).json({ message: result.message });
    }

    return res.status(200).json({ data: result.data });
  } catch (err) {
    logger.error('Erreur dans rechercherColisParReferenceController', { error: err.message, stack: err.stack, user_id: req.user?.id });
    return res.status(500).json({
      message: 'Erreur serveur lors de la recherche du colis',
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

// 🔹 Récupérer les notifications reçues par l'utilisateur connecté
exports.getNotificationsController = async (req, res) => {
  try {
    const utilisateurId = req.user.id;

    const result = await EnvoieColisService.getNotifications(utilisateurId);

    if (!result.success) {
      return res.status(400).json({ message: result.message });
    }

    return res.status(200).json({ data: result.data });
  } catch (err) {
    logger.error('Erreur dans getNotificationsController', { error: err.message, stack: err.stack, user_id: req.user?.id });
    return res.status(500).json({
      message: 'Erreur serveur lors de la récupération des notifications',
      erreur: err.message
    });
  }
};

// 🔹 Liste des pays actifs (pour le mobile)
exports.getCountriesController = async (req, res) => {
  try {
    const countries = await Country.findAll({
      where: { isActive: true },
      attributes: ['id', 'name', 'code'],
      order: [['name', 'ASC']],
    });
    return res.status(200).json({ success: true, data: countries });
  } catch (err) {
    logger.error('Erreur dans getCountriesController', { error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// 🔹 Prix shipping + services pour un pays (pour le mobile)
exports.getPricingByCountryController = async (req, res) => {
  try {
    const { countryId } = req.params;

    const country = await Country.findByPk(countryId, { attributes: ['id', 'name', 'code', 'isActive'] });
    if (!country || !country.isActive) {
      return res.status(404).json({ success: false, message: 'Pays non trouvé' });
    }

    // Utilise le nouveau modèle ShippingRate (aérien + maritime en une ligne)
    const rateData = await ShippingRateService.getPricingForCountry(countryId);
    // Fallback vers l'ancien modèle ShippingPrice si pas encore migré
    let shippingPrices = rateData ? rateData.shippingPrices : [];
    if (!rateData) {
      const oldPrices = await ShippingPrice.findAll({
        where: { countryId },
        attributes: ['id', 'type', 'minWeight', 'maxWeight', 'pricePerKg'],
        order: [['type', 'ASC'], ['minWeight', 'ASC']],
      });
      shippingPrices = oldPrices;
    }

    // Utilise le nouveau modèle ServiceRate (récupération + livraison en une ligne)
    const rateServiceData = await ServiceRateService.getServicesForCountry(countryId);
    let servicePrices = rateServiceData ? rateServiceData.servicePrices : [];
    if (!rateServiceData) {
      servicePrices = await ServicePrice.findAll({
        where: { countryId },
        attributes: ['id', 'serviceType', 'price'],
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        country: { id: country.id, name: country.name, code: country.code },
        shippingPrices,
        servicePrices,
      },
    });
  } catch (err) {
    logger.error('Erreur dans getPricingByCountryController', { error: err.message, stack: err.stack });
    return res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

// 🔹 Marquer une notification comme lue
exports.marquerNotificationCommeLueController = async (req, res) => {
  try {
    const { notificationId } = req.params;

    const result = await EnvoieColisService.marquerNotificationCommeLue(notificationId);

    if (!result.success) {
      return res.status(400).json({ message: result.message });
    }

    return res.status(200).json({ message: 'Notification marquée comme lue', data: result.data });
  } catch (err) {
    logger.error('Erreur dans marquerNotificationCommeLueController', { error: err.message, stack: err.stack, user_id: req.user?.id });
    return res.status(500).json({
      message: 'Erreur serveur lors de la mise à jour de la notification',
      erreur: err.message
    });
  }
};