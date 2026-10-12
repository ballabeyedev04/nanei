const ShippingRate = require('../models/shippingRate.model');
const Country = require('../models/country.model');

const WITH_COUNTRY = {
  include: [{ model: Country, as: 'country', attributes: ['id', 'name', 'code'] }],
};

// Poids >= 0, prix > 0, valeurs numériques : voir utils/validationNombres.js.
const { erreurNombres } = require('../utils/validationNombres');

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
    const erreur = erreurNombres([
      ['Poids min. aérien', minWeightAerien], ['Poids max. aérien', maxWeightAerien, { strict: true }],
      ['Prix aérien / kg', priceAerienPerKg, { strict: true }],
      ['Poids min. maritime', minWeightMaritime], ['Poids max. maritime', maxWeightMaritime, { strict: true }],
      ['Prix maritime / kg', priceMaritimePerKg, { strict: true }],
    ]);
    if (erreur) return { success: false, message: erreur };
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

    const { minWeightAerien, maxWeightAerien, priceAerienPerKg, minWeightMaritime, maxWeightMaritime, priceMaritimePerKg } = body;
    const erreur = erreurNombres([
      ['Poids min. aérien', minWeightAerien], ['Poids max. aérien', maxWeightAerien, { strict: true }],
      ['Prix aérien / kg', priceAerienPerKg, { strict: true }],
      ['Poids min. maritime', minWeightMaritime], ['Poids max. maritime', maxWeightMaritime, { strict: true }],
      ['Prix maritime / kg', priceMaritimePerKg, { strict: true }],
    ]);
    if (erreur) return { success: false, message: erreur };

    // Comparaison sur les valeurs FINALES (saisie fusionnée avec l'existant) :
    // avant, ne modifier que le max (ex. max 1 kg alors que min = 5 kg)
    // enregistrait une plage vide sans erreur.
    const final = (v, actuel) => Number(v ?? actuel);
    if (final(minWeightAerien, rate.minWeightAerien) >= final(maxWeightAerien, rate.maxWeightAerien)) {
      return { success: false, message: 'Poids min aérien doit être < poids max aérien' };
    }
    if (final(minWeightMaritime, rate.minWeightMaritime) >= final(maxWeightMaritime, rate.maxWeightMaritime)) {
      return { success: false, message: 'Poids min maritime doit être < poids max maritime' };
    }

    // Le pays d'un tarif ne change pas (un tarif par pays) : `countryId` est
    // ignoré, comme pour les tarifs de services. Avant, il était accepté sans
    // contrôle (pays inexistant ou deuxième tarif pour un même pays possibles).
    await rate.update({ minWeightAerien: minWeightAerien ?? rate.minWeightAerien, maxWeightAerien: maxWeightAerien ?? rate.maxWeightAerien, priceAerienPerKg: priceAerienPerKg ?? rate.priceAerienPerKg, minWeightMaritime: minWeightMaritime ?? rate.minWeightMaritime, maxWeightMaritime: maxWeightMaritime ?? rate.maxWeightMaritime, priceMaritimePerKg: priceMaritimePerKg ?? rate.priceMaritimePerKg });
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
