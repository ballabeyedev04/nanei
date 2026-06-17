const ShippingRate = require('../models/shippingRate.model');
const Country = require('../models/country.model');

const WITH_COUNTRY = {
  include: [{ model: Country, as: 'country', attributes: ['id', 'name', 'code'] }],
};

class ShippingRateService {
  static async getAll(filters = {}) {
    const where = {};
    if (filters.countryId) where.countryId = filters.countryId;
    const data = await ShippingRate.findAll({ where, ...WITH_COUNTRY, order: [['countryId', 'ASC']] });
    return { success: true, data };
  }

  static async getById(id) {
    const rate = await ShippingRate.findByPk(id, WITH_COUNTRY);
    if (!rate) return { success: false, message: 'Tarif non trouvé' };
    return { success: true, data: rate };
  }

  static async create(body) {
    const { countryId, minWeightAerien, maxWeightAerien, priceAerienPerKg, minWeightMaritime, maxWeightMaritime, priceMaritimePerKg } = body;

    if (!countryId || minWeightAerien == null || maxWeightAerien == null || priceAerienPerKg == null ||
        minWeightMaritime == null || maxWeightMaritime == null || priceMaritimePerKg == null) {
      return { success: false, message: 'Tous les champs sont obligatoires (aérien + maritime)' };
    }
    if (parseFloat(minWeightAerien) >= parseFloat(maxWeightAerien)) {
      return { success: false, message: 'Poids min aérien doit être < poids max aérien' };
    }
    if (parseFloat(minWeightMaritime) >= parseFloat(maxWeightMaritime)) {
      return { success: false, message: 'Poids min maritime doit être < poids max maritime' };
    }

    const country = await Country.findByPk(countryId);
    if (!country) return { success: false, message: 'Pays non trouvé' };

    const existing = await ShippingRate.findOne({ where: { countryId } });
    if (existing) return { success: false, message: 'Un tarif existe déjà pour ce pays. Modifiez-le.' };

    const rate = await ShippingRate.create({ countryId, minWeightAerien, maxWeightAerien, priceAerienPerKg, minWeightMaritime, maxWeightMaritime, priceMaritimePerKg });
    const full = await ShippingRate.findByPk(rate.id, WITH_COUNTRY);
    return { success: true, message: 'Tarif créé avec succès', data: full };
  }

  static async update(id, body) {
    const rate = await ShippingRate.findByPk(id);
    if (!rate) return { success: false, message: 'Tarif non trouvé' };

    const { minWeightAerien, maxWeightAerien, priceAerienPerKg, minWeightMaritime, maxWeightMaritime, priceMaritimePerKg, countryId } = body;

    if (minWeightAerien != null && maxWeightAerien != null && parseFloat(minWeightAerien) >= parseFloat(maxWeightAerien)) {
      return { success: false, message: 'Poids min aérien doit être < poids max aérien' };
    }
    if (minWeightMaritime != null && maxWeightMaritime != null && parseFloat(minWeightMaritime) >= parseFloat(maxWeightMaritime)) {
      return { success: false, message: 'Poids min maritime doit être < poids max maritime' };
    }

    await rate.update({ countryId: countryId ?? rate.countryId, minWeightAerien: minWeightAerien ?? rate.minWeightAerien, maxWeightAerien: maxWeightAerien ?? rate.maxWeightAerien, priceAerienPerKg: priceAerienPerKg ?? rate.priceAerienPerKg, minWeightMaritime: minWeightMaritime ?? rate.minWeightMaritime, maxWeightMaritime: maxWeightMaritime ?? rate.maxWeightMaritime, priceMaritimePerKg: priceMaritimePerKg ?? rate.priceMaritimePerKg });
    const full = await ShippingRate.findByPk(id, WITH_COUNTRY);
    return { success: true, message: 'Tarif mis à jour', data: full };
  }

  static async delete(id) {
    const rate = await ShippingRate.findByPk(id);
    if (!rate) return { success: false, message: 'Tarif non trouvé' };
    await rate.destroy();
    return { success: true, message: 'Tarif supprimé' };
  }

  // Utilisé par l'endpoint mobile — retourne le format liste attendu par le mobile
  static async getPricingForCountry(countryId) {
    const rate = await ShippingRate.findOne({ where: { countryId }, ...WITH_COUNTRY });
    if (!rate) return null;

    return {
      country: { id: rate.country.id, name: rate.country.name, code: rate.country.code },
      shippingPrices: [
        { type: 'aérien',   minWeight: rate.minWeightAerien,   maxWeight: rate.maxWeightAerien,   pricePerKg: rate.priceAerienPerKg   },
        { type: 'maritime', minWeight: rate.minWeightMaritime, maxWeight: rate.maxWeightMaritime, pricePerKg: rate.priceMaritimePerKg },
      ],
    };
  }
}

module.exports = ShippingRateService;
