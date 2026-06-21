const ServicePriceService = require('../../services/servicePrice.service');
const logger = require('../../config/logger');

exports.getServicePrices = async (req, res) => {
  try {
    const { countryId, serviceType } = req.query;

    const filters = {};
    if (countryId) filters.countryId = countryId;
    if (serviceType) filters.serviceType = serviceType;

    const result = await ServicePriceService.getServicePrices(filters);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json({
      message: 'Prix de services récupérés avec succès',
      data: result.data,
    });
  } catch (error) {
    logger.error('Erreur getServicePrices', { error: error.message, user_id: req.user?.id });
    return res.status(500).json({
      message: 'Erreur serveur',
      error: error.message,
    });
  }
};

exports.getServicePriceById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await ServicePriceService.getServicePriceById(id);

    if (!result.success) {
      return res.status(404).json(result);
    }

    return res.status(200).json({
      message: 'Prix de service récupéré avec succès',
      data: result.data,
    });
  } catch (error) {
    logger.error('Erreur getServicePriceById', { error: error.message, user_id: req.user?.id });
    return res.status(500).json({
      message: 'Erreur serveur',
      error: error.message,
    });
  }
};

exports.createServicePrice = async (req, res) => {
  try {
    const result = await ServicePriceService.createServicePrice(req.body);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(201).json(result);
  } catch (error) {
    logger.error('Erreur createServicePrice', { error: error.message, user_id: req.user?.id });
    return res.status(500).json({
      message: 'Erreur serveur',
      error: error.message,
    });
  }
};

exports.updateServicePrice = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await ServicePriceService.updateServicePrice(id, req.body);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    logger.error('Erreur updateServicePrice', { error: error.message, user_id: req.user?.id });
    return res.status(500).json({
      message: 'Erreur serveur',
      error: error.message,
    });
  }
};

exports.deleteServicePrice = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await ServicePriceService.deleteServicePrice(id);

    if (!result.success) {
      return res.status(404).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    logger.error('Erreur deleteServicePrice', { error: error.message, user_id: req.user?.id });
    return res.status(500).json({
      message: 'Erreur serveur',
      error: error.message,
    });
  }
};
