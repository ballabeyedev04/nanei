const ShippingPrice = require('../models/shippingPrice.model');
const Country = require('../models/country.model');
const { Op } = require('sequelize');

class ShippingPriceService {
  static async getShippingPrices(filters = {}) {
    try {
      const where = {};
      if (filters.countryId) {
        where.countryId = filters.countryId;
      }
      if (filters.type) {
        where.type = filters.type;
      }

      const prices = await ShippingPrice.findAll({
        where,
        include: [
          {
            model: Country,
            as: 'country',
            attributes: ['id', 'name', 'code'],
          },
        ],
        order: [['countryId', 'ASC'], ['type', 'ASC'], ['minWeight', 'ASC']],
      });

      return {
        success: true,
        data: prices,
      };
    } catch (error) {
      console.error('Error fetching shipping prices:', error);
      return {
        success: false,
        message: 'Erreur lors de la récupération des prix de transport',
        error: error.message,
      };
    }
  }

  static async getShippingPriceById(id) {
    try {
      const price = await ShippingPrice.findByPk(id, {
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
          message: 'Prix de transport non trouvé',
        };
      }

      return {
        success: true,
        data: price,
      };
    } catch (error) {
      console.error('Error fetching shipping price:', error);
      return {
        success: false,
        message: 'Erreur lors de la récupération du prix',
        error: error.message,
      };
    }
  }

  static async createShippingPrice(data) {
    try {
      const { countryId, type, minWeight, maxWeight, pricePerKg } = data;

      if (!countryId || !type || minWeight === undefined || maxWeight === undefined || pricePerKg === undefined) {
        return {
          success: false,
          message: 'Tous les champs sont obligatoires',
        };
      }

      if (!['aérien', 'maritime'].includes(type)) {
        return {
          success: false,
          message: 'Type invalide. Doit être "aérien" ou "maritime"',
        };
      }

      if (minWeight >= maxWeight) {
        return {
          success: false,
          message: 'Le poids minimum doit être inférieur au poids maximum',
        };
      }

      const country = await Country.findByPk(countryId);
      if (!country) {
        return {
          success: false,
          message: 'Pays non trouvé',
        };
      }

      // Vérifier les chevauchements de poids
      const existingPrice = await ShippingPrice.findOne({
        where: {
          countryId,
          type,
          [Op.or]: [
            { minWeight: { [Op.lt]: maxWeight }, maxWeight: { [Op.gt]: minWeight } },
          ],
        },
      });

      if (existingPrice) {
        return {
          success: false,
          message: 'Une plage de poids qui chevauche existe déjà pour ce pays et ce type de transport',
        };
      }

      const price = await ShippingPrice.create({
        countryId,
        type,
        minWeight,
        maxWeight,
        pricePerKg,
      });

      const priceWithCountry = await ShippingPrice.findByPk(price.id, {
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
        message: 'Prix de transport créé avec succès',
        data: priceWithCountry,
      };
    } catch (error) {
      console.error('Error creating shipping price:', error);
      return {
        success: false,
        message: 'Erreur lors de la création du prix',
        error: error.message,
      };
    }
  }

  static async updateShippingPrice(id, data) {
    try {
      const price = await ShippingPrice.findByPk(id);

      if (!price) {
        return {
          success: false,
          message: 'Prix de transport non trouvé',
        };
      }

      const { countryId, type, minWeight, maxWeight, pricePerKg } = data;

      if (countryId && countryId !== price.countryId) {
        const country = await Country.findByPk(countryId);
        if (!country) {
          return {
            success: false,
            message: 'Pays non trouvé',
          };
        }
      }

      if (minWeight !== undefined && maxWeight !== undefined && minWeight >= maxWeight) {
        return {
          success: false,
          message: 'Le poids minimum doit être inférieur au poids maximum',
        };
      }

      // Vérifier les chevauchements si poids ou type a changé
      if ((minWeight !== undefined || maxWeight !== undefined || type !== undefined) && countryId) {
        const newMinWeight = minWeight !== undefined ? minWeight : price.minWeight;
        const newMaxWeight = maxWeight !== undefined ? maxWeight : price.maxWeight;
        const newType = type || price.type;

        const existingPrice = await ShippingPrice.findOne({
          where: {
            countryId: countryId || price.countryId,
            type: newType,
            id: { [Op.ne]: id },
            [Op.or]: [
              { minWeight: { [Op.lt]: newMaxWeight }, maxWeight: { [Op.gt]: newMinWeight } },
            ],
          },
        });

        if (existingPrice) {
          return {
            success: false,
            message: 'Une plage de poids qui chevauche existe déjà',
          };
        }
      }

      await price.update({
        countryId: countryId || price.countryId,
        type: type || price.type,
        minWeight: minWeight !== undefined ? minWeight : price.minWeight,
        maxWeight: maxWeight !== undefined ? maxWeight : price.maxWeight,
        pricePerKg: pricePerKg !== undefined ? pricePerKg : price.pricePerKg,
      });

      const updatedPrice = await ShippingPrice.findByPk(id, {
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
      console.error('Error updating shipping price:', error);
      return {
        success: false,
        message: 'Erreur lors de la mise à jour du prix',
        error: error.message,
      };
    }
  }

  /**
   * Crée ou met à jour les 2 lignes aérien + maritime pour une même tranche de poids.
   * Body: { countryId, minWeight, maxWeight, aerienPricePerKg, maritimePricePerKg }
   */
  static async createOrUpdateBulk(data) {
    try {
      const { countryId, minWeight, maxWeight, aerienPricePerKg, maritimePricePerKg, aerienId, maritimeId } = data;

      if (!countryId || minWeight === undefined || maxWeight === undefined || aerienPricePerKg === undefined || maritimePricePerKg === undefined) {
        return { success: false, message: 'Tous les champs sont obligatoires' };
      }
      if (parseFloat(minWeight) >= parseFloat(maxWeight)) {
        return { success: false, message: 'Le poids minimum doit être inférieur au poids maximum' };
      }

      const country = await Country.findByPk(countryId);
      if (!country) return { success: false, message: 'Pays non trouvé' };

      const results = [];
      for (const { type, pricePerKg, existingId } of [
        { type: 'aérien',    pricePerKg: aerienPricePerKg,   existingId: aerienId   },
        { type: 'maritime',  pricePerKg: maritimePricePerKg, existingId: maritimeId },
      ]) {
        if (existingId) {
          // Mise à jour
          const existing = await ShippingPrice.findByPk(existingId);
          if (existing) {
            await existing.update({ countryId, type, minWeight, maxWeight, pricePerKg });
            results.push(existing);
          }
        } else {
          // Vérifie chevauchement
          const overlap = await ShippingPrice.findOne({
            where: {
              countryId, type,
              [Op.or]: [{ minWeight: { [Op.lt]: maxWeight }, maxWeight: { [Op.gt]: minWeight } }],
            },
          });
          if (overlap) {
            return { success: false, message: `Chevauchement de poids pour le type ${type}` };
          }
          const created = await ShippingPrice.create({ countryId, type, minWeight, maxWeight, pricePerKg });
          results.push(created);
        }
      }

      return { success: true, message: 'Tarifs créés/mis à jour avec succès', data: results };
    } catch (error) {
      console.error('Error in createOrUpdateBulk:', error);
      return { success: false, message: 'Erreur serveur', error: error.message };
    }
  }

  static async deleteShippingPrice(id) {
    try {
      const price = await ShippingPrice.findByPk(id);

      if (!price) {
        return {
          success: false,
          message: 'Prix de transport non trouvé',
        };
      }

      await price.destroy();

      return {
        success: true,
        message: 'Prix supprimé avec succès',
      };
    } catch (error) {
      console.error('Error deleting shipping price:', error);
      return {
        success: false,
        message: 'Erreur lors de la suppression du prix',
        error: error.message,
      };
    }
  }
}

module.exports = ShippingPriceService;
