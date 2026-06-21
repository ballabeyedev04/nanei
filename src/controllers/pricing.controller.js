const PricingCalculatorService = require('../services/pricingCalculator.service');
const logger = require('../config/logger');

exports.calculatePrice = async (req, res) => {
  try {
    const { countryId, weight, shippingType, needsPickup, needsDelivery } = req.body;

    if (!countryId || weight === undefined || !shippingType) {
      return res.status(400).json({
        success: false,
        message: 'Les paramètres countryId, weight et shippingType sont obligatoires',
      });
    }

    const result = await PricingCalculatorService.calculateTotalPrice(
      countryId,
      weight,
      shippingType,
      needsPickup || false,
      needsDelivery || false
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json({
      success: true,
      message: 'Prix calculé avec succès',
      data: result.data,
    });
  } catch (error) {
    logger.error('Erreur calculatePrice', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Erreur serveur lors du calcul du prix',
      error: error.message,
    });
  }
};
