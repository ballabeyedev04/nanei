const ServicePriceService = require('../../services/servicePrice.service');

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
    console.error('Error in getServicePrices:', error);
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
    console.error('Error in getServicePriceById:', error);
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
    console.error('Error in createServicePrice:', error);
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
    console.error('Error in updateServicePrice:', error);
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
    console.error('Error in deleteServicePrice:', error);
    return res.status(500).json({
      message: 'Erreur serveur',
      error: error.message,
    });
  }
};
