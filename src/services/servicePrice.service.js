const ServicePrice = require('../models/servicePrice.model');
const Country = require('../models/country.model');
const logger = require('../config/logger');

class ServicePriceService {
  static async getServicePrices(filters = {}) {
    try {
      const where = {};
      if (filters.countryId) {
        where.countryId = filters.countryId;
      }
      if (filters.serviceType) {
        where.serviceType = filters.serviceType;
      }

      const prices = await ServicePrice.findAll({
        where,
        include: [
          {
            model: Country,
            as: 'country',
            attributes: ['id', 'name', 'code'],
          },
        ],
        order: [['countryId', 'ASC'], ['serviceType', 'ASC']],
      });

      return {
        success: true,
        data: prices,
      };
    } catch (error) {
      logger.error('Erreur fetchServicePrices', { error: error.message });
      return {
        success: false,
        message: 'Erreur lors de la récupération des prix de services',
        error: error.message,
      };
    }
  }

  static async getServicePriceById(id) {
    try {
      const price = await ServicePrice.findByPk(id, {
        include: [
          {
            model: Country,
            as: 'country',
            attributes: ['id', 'name', 'code'],
          },
        ],
      });

      if (!price) {
        return {
          success: false,
          message: 'Prix de service non trouvé',
        };
      }

      return {
        success: true,
        data: price,
      };
    } catch (error) {
      logger.error('Erreur fetchServicePrice', { error: error.message });
      return {
        success: false,
        message: 'Erreur lors de la récupération du prix',
        error: error.message,
      };
    }
  }

  static async createServicePrice(data) {
    try {
      const { serviceType, countryId, price } = data;

      if (!serviceType || !countryId || price === undefined) {
        return {
          success: false,
          message: 'Tous les champs sont obligatoires',
        };
      }

      if (!['récupération', 'livraison'].includes(serviceType)) {
        return {
          success: false,
          message: 'Type de service invalide. Doit être "récupération" ou "livraison"',
        };
      }

      const country = await Country.findByPk(countryId);
      if (!country) {
        return {
          success: false,
          message: 'Pays non trouvé',
        };
      }

      // Vérifier les doublons
      const existingPrice = await ServicePrice.findOne({
        where: {
          serviceType,
          countryId,
        },
      });

      if (existingPrice) {
        return {
          success: false,
          message: 'Un prix pour ce service et ce pays existe déjà',
        };
      }

      const servicePrice = await ServicePrice.create({
        serviceType,
        countryId,
        price,
      });

      const servicePriceWithCountry = await ServicePrice.findByPk(servicePrice.id, {
        include: [
          {
            model: Country,
            as: 'country',
            attributes: ['id', 'name', 'code'],
          },
        ],
      });

      return {
        success: true,
        message: 'Prix de service créé avec succès',
        data: servicePriceWithCountry,
      };
    } catch (error) {
      logger.error('Erreur createServicePrice', { error: error.message });
      return {
        success: false,
        message: 'Erreur lors de la création du prix',
        error: error.message,
      };
    }
  }

  static async updateServicePrice(id, data) {
    try {
      const servicePrice = await ServicePrice.findByPk(id);

      if (!servicePrice) {
        return {
          success: false,
          message: 'Prix de service non trouvé',
        };
      }

      const { serviceType, countryId, price } = data;

      if (countryId && countryId !== servicePrice.countryId) {
        const country = await Country.findByPk(countryId);
        if (!country) {
          return {
            success: false,
          message: 'Pays non trouvé',
          };
        }
      }

      if (serviceType && !['récupération', 'livraison'].includes(serviceType)) {
        return {
          success: false,
          message: 'Type de service invalide',
        };
      }

      await servicePrice.update({
        serviceType: serviceType || servicePrice.serviceType,
        countryId: countryId || servicePrice.countryId,
        price: price !== undefined ? price : servicePrice.price,
      });

      const updatedPrice = await ServicePrice.findByPk(id, {
        include: [
          {
            model: Country,
            as: 'country',
            attributes: ['id', 'name', 'code'],
          },
        ],
      });

      return {
        success: true,
        message: 'Prix mis à jour avec succès',
        data: updatedPrice,
      };
    } catch (error) {
      logger.error('Erreur updateServicePrice', { error: error.message });
      return {
        success: false,
        message: 'Erreur lors de la mise à jour du prix',
        error: error.message,
      };
    }
  }

  static async deleteServicePrice(id) {
    try {
      const price = await ServicePrice.findByPk(id);

      if (!price) {
        return {
          success: false,
          message: 'Prix de service non trouvé',
        };
      }

      await price.destroy();

      return {
        success: true,
        message: 'Prix supprimé avec succès',
      };
    } catch (error) {
      logger.error('Erreur deleteServicePrice', { error: error.message });
      return {
        success: false,
        message: 'Erreur lors de la suppression du prix',
        error: error.message,
      };
    }
  }
}

module.exports = ServicePriceService;
