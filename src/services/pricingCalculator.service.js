const ShippingPrice = require('../models/shippingPrice.model');
const ServicePrice = require('../models/servicePrice.model');
const Country = require('../models/country.model');
const logger = require('../config/logger');

class PricingCalculatorService {
  static async calculateShippingPrice(countryId, weight, type) {
    try {
      if (!countryId || weight === undefined || !type) {
        return {
          success: false,
          message: 'Les paramètres countryId, weight et type sont obligatoires',
        };
      }

      const price = await ShippingPrice.findOne({
        where: {
          countryId,
          type,
        },
        // Obtenir la plage de poids appropriée
        raw: true,
      });

      // Chercher la plage de poids correcte
      const shippingPrice = await ShippingPrice.findOne({
        where: {
          countryId,
          type,
        },
        sequelize: ShippingPrice.sequelize,
      });

      if (!shippingPrice) {
        return {
          success: false,
          message: `Aucun prix trouvé pour le pays et le type de transport spécifiés`,
        };
      }

      // Chercher la bonne plage de poids
      const allPrices = await ShippingPrice.findAll({
        where: {
          countryId,
          type,
        },
        order: [['minWeight', 'ASC']],
      });

      let applicablePrice = null;
      for (const p of allPrices) {
        if (weight >= p.minWeight && weight <= p.maxWeight) {
          applicablePrice = p;
          break;
        }
      }

      if (!applicablePrice) {
        return {
          success: false,
          message: `Aucune plage de poids ne correspond au poids de ${weight}kg`,
        };
      }

      const totalShippingPrice = weight * applicablePrice.pricePerKg;

      return {
        success: true,
        data: {
          shippingPrice: totalShippingPrice,
          pricePerKg: applicablePrice.pricePerKg,
          weight,
          weightRange: {
            min: applicablePrice.minWeight,
            max: applicablePrice.maxWeight,
          },
        },
      };
    } catch (error) {
      logger.error('Erreur calculShippingPrice', { error: error.message });
      return {
        success: false,
        message: 'Erreur lors du calcul du prix de transport',
        error: error.message,
      };
    }
  }

  static async getServicePrice(serviceType, countryId) {
    try {
      const price = await ServicePrice.findOne({
        where: {
          serviceType,
          countryId,
        },
        raw: true,
      });

      if (!price) {
        return {
          success: false,
          message: 'Prix de service non trouvé',
          price: 0,
        };
      }

      return {
        success: true,
        price: price.price,
      };
    } catch (error) {
      logger.error('Erreur getServicePrice', { error: error.message });
      return {
        success: false,
        message: 'Erreur lors de la récupération du prix de service',
        price: 0,
      };
    }
  }

  static async calculateTotalPrice(countryId, weight, type, needsPickup = false, needsDelivery = false) {
    try {
      if (!countryId || weight === undefined || !type) {
        return {
          success: false,
          message: 'Les paramètres countryId, weight et type sont obligatoires',
        };
      }

      // Vérifier que le pays existe
      const country = await Country.findByPk(countryId);
      if (!country) {
        return {
          success: false,
          message: 'Pays non trouvé',
        };
      }

      // Calculer le prix de transport
      const shippingResult = await this.calculateShippingPrice(countryId, weight, type);
      if (!shippingResult.success) {
        return shippingResult;
      }

      const shippingPrice = shippingResult.data.shippingPrice;

      // Obtenir le prix de récupération
      let pickupPrice = 0;
      if (needsPickup) {
        const pickupResult = await this.getServicePrice('récupération', countryId);
        pickupPrice = pickupResult.price;
      }

      // Obtenir le prix de livraison
      let deliveryPrice = 0;
      if (needsDelivery) {
        const deliveryResult = await this.getServicePrice('livraison', countryId);
        deliveryPrice = deliveryResult.price;
      }

      const total = shippingPrice + pickupPrice + deliveryPrice;

      return {
        success: true,
        data: {
          shippingPrice: parseFloat(shippingPrice.toFixed(2)),
          pickupPrice: parseFloat(pickupPrice.toFixed(2)),
          deliveryPrice: parseFloat(deliveryPrice.toFixed(2)),
          total: parseFloat(total.toFixed(2)),
          breakdown: {
            weight,
            type,
            country: country.name,
            needsPickup,
            needsDelivery,
          },
        },
      };
    } catch (error) {
      logger.error('Erreur calculTotalPrice', { error: error.message });
      return {
        success: false,
        message: 'Erreur lors du calcul du prix total',
        error: error.message,
      };
    }
  }
}

module.exports = PricingCalculatorService;
