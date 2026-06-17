const ServiceRate = require('../models/serviceRate.model');
const Country = require('../models/country.model');

class ServiceRateService {
  static async getAll() {
    const rates = await ServiceRate.findAll({
      include: [{ model: Country, as: 'country', attributes: ['id', 'name', 'code'] }],
      order: [['createdAt', 'ASC']],
    });
    return { success: true, data: rates };
  }

  static async getById(id) {
    const rate = await ServiceRate.findByPk(id, {
      include: [{ model: Country, as: 'country', attributes: ['id', 'name', 'code'] }],
    });
    if (!rate) return { success: false, message: 'Tarif service non trouvé' };
    return { success: true, data: rate };
  }

  static async create(data) {
    const { countryId, prixRecuperation, prixLivraison } = data;

    if (!countryId || prixRecuperation === undefined || prixLivraison === undefined) {
      return { success: false, message: 'Tous les champs sont obligatoires' };
    }

    const country = await Country.findByPk(countryId);
    if (!country) return { success: false, message: 'Pays non trouvé' };

    const existing = await ServiceRate.findOne({ where: { countryId } });
    if (existing) return { success: false, message: 'Un tarif de service existe déjà pour ce pays' };

    const rate = await ServiceRate.create({ countryId, prixRecuperation, prixLivraison });
    const full = await ServiceRate.findByPk(rate.id, {
      include: [{ model: Country, as: 'country', attributes: ['id', 'name', 'code'] }],
    });
    return { success: true, message: 'Tarif service créé avec succès', data: full };
  }

  static async update(id, data) {
    const rate = await ServiceRate.findByPk(id);
    if (!rate) return { success: false, message: 'Tarif service non trouvé' };

    await rate.update({
      prixRecuperation: data.prixRecuperation ?? rate.prixRecuperation,
      prixLivraison: data.prixLivraison ?? rate.prixLivraison,
    });

    const full = await ServiceRate.findByPk(id, {
      include: [{ model: Country, as: 'country', attributes: ['id', 'name', 'code'] }],
    });
    return { success: true, message: 'Tarif mis à jour', data: full };
  }

  static async delete(id) {
    const rate = await ServiceRate.findByPk(id);
    if (!rate) return { success: false, message: 'Tarif service non trouvé' };
    await rate.destroy();
    return { success: true, message: 'Tarif supprimé' };
  }

  // Retourne le format compatible mobile : [{serviceType, price}]
  static async getServicesForCountry(countryId) {
    const rate = await ServiceRate.findOne({ where: { countryId } });
    if (!rate) return null;
    return {
      servicePrices: [
        { serviceType: 'récupération', price: rate.prixRecuperation },
        { serviceType: 'livraison',    price: rate.prixLivraison },
      ],
    };
  }
}

module.exports = ServiceRateService;
