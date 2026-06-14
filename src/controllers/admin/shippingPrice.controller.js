const ShippingPriceService = require('../../services/shippingPrice.service');

exports.getShippingPrices = async (req, res) => {
  try {
    const { countryId, type } = req.query;

    const filters = {};
    if (countryId) filters.countryId = countryId;
    if (type) filters.type = type;

    const result = await ShippingPriceService.getShippingPrices(filters);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json({
      message: 'Prix de transport récupérés avec succès',
      data: result.data,
    });
  } catch (error) {
    console.error('Error in getShippingPrices:', error);
    return res.status(500).json({
      message: 'Erreur serveur',
      error: error.message,
    });
  }
};

exports.getShippingPriceById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await ShippingPriceService.getShippingPriceById(id);

    if (!result.success) {
      return res.status(404).json(result);
    }

    return res.status(200).json({
      message: 'Prix de transport récupéré avec succès',
      data: result.data,
    });
  } catch (error) {
    console.error('Error in getShippingPriceById:', error);
    return res.status(500).json({
      message: 'Erreur serveur',
      error: error.message,
    });
  }
};

exports.createShippingPrice = async (req, res) => {
  try {
    const result = await ShippingPriceService.createShippingPrice(req.body);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(201).json(result);
  } catch (error) {
    console.error('Error in createShippingPrice:', error);
    return res.status(500).json({
      message: 'Erreur serveur',
      error: error.message,
    });
  }
};

exports.updateShippingPrice = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await ShippingPriceService.updateShippingPrice(id, req.body);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error in updateShippingPrice:', error);
    return res.status(500).json({
      message: 'Erreur serveur',
      error: error.message,
    });
  }
};

exports.deleteShippingPrice = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await ShippingPriceService.deleteShippingPrice(id);

    if (!result.success) {
      return res.status(404).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error in deleteShippingPrice:', error);
    return res.status(500).json({
      message: 'Erreur serveur',
      error: error.message,
    });
  }
};
