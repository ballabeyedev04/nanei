const { Op, fn, col, where: sqlWhere } = require('sequelize');
const Country = require('../models/country.model');

/** Pays déjà existant avec ce nom (sans tenir compte de la casse) ou ce code. */
async function doublonPays({ name, code }, saufId) {
  const conditions = [];
  if (name) conditions.push(sqlWhere(fn('lower', col('name')), String(name).trim().toLowerCase()));
  if (code) conditions.push({ code: String(code).trim().toUpperCase() });
  if (!conditions.length) return null;
  const existant = await Country.findOne({
    where: { [Op.or]: conditions, ...(saufId ? { id: { [Op.ne]: saufId } } : {}) },
  });
  if (!existant) return null;
  return code && existant.code === String(code).trim().toUpperCase()
    ? 'Un pays avec ce code existe déjà'
    : 'Un pays avec ce nom existe déjà';
}
const logger = require('../config/logger');

class CountryService {
  static async getCountries(filters = {}) {
    try {
      const where = {};
      if (filters.isActive !== undefined) {
        where.isActive = filters.isActive;
      }

      const countries = await Country.findAll({
        where,
        order: [['name', 'ASC']],
      });

      return {
        success: true,
        data: countries,
      };
    } catch (error) {
      logger.error('Erreur fetchCountries', { error: error.message });
      return {
        success: false,
        message: 'Erreur lors de la récupération des pays',
        error: error.message,
      };
    }
  }

  static async getCountryById(id) {
    try {
      const country = await Country.findByPk(id);

      if (!country) {
        return {
          success: false,
          message: 'Pays non trouvé',
        };
      }

      return {
        success: true,
        data: country,
      };
    } catch (error) {
      logger.error('Erreur fetchCountry', { error: error.message });
      return {
        success: false,
        message: 'Erreur lors de la récupération du pays',
        error: error.message,
      };
    }
  }

  static async createCountry(data) {
    try {
      const { name, code, isActive } = data;

      if (!name || !code) {
        return {
          success: false,
          message: 'Le nom et le code du pays sont obligatoires',
        };
      }

      // Code comparé en MAJUSCULES (il est enregistré ainsi) : « fra » contre
      // « FRA » donnait avant une erreur générique de contrainte unique.
      const doublon = await doublonPays({ name, code });
      if (doublon) {
        return { success: false, message: doublon };
      }

      const country = await Country.create({
        name: String(name).trim(),
        code: String(code).trim().toUpperCase(),
        isActive: isActive !== false,
      });

      return {
        success: true,
        message: 'Pays créé avec succès',
        data: country,
      };
    } catch (error) {
      logger.error('Erreur createCountry', { error: error.message });
      return {
        success: false,
        message: 'Erreur lors de la création du pays',
        error: error.message,
      };
    }
  }

  static async updateCountry(id, data) {
    try {
      const country = await Country.findByPk(id);

      if (!country) {
        return {
          success: false,
          message: 'Pays non trouvé',
        };
      }

      const { name, code, isActive } = data;

      const doublon = await doublonPays({ name, code }, country.id);
      if (doublon) {
        return { success: false, message: doublon };
      }

      await country.update({
        name: name ? String(name).trim() : country.name,
        code: code ? String(code).trim().toUpperCase() : country.code,
        isActive: isActive !== undefined ? isActive : country.isActive,
      });

      return {
        success: true,
        message: 'Pays mis à jour avec succès',
        data: country,
      };
    } catch (error) {
      logger.error('Erreur updateCountry', { error: error.message });
      return {
        success: false,
        message: 'Erreur lors de la mise à jour du pays',
        error: error.message,
      };
    }
  }

  static async deleteCountry(id) {
    try {
      const country = await Country.findByPk(id);

      if (!country) {
        return {
          success: false,
          status: 404,
          message: 'Pays non trouvé',
        };
      }

      // Un pays encore utilisé ne peut pas être supprimé (clés étrangères) :
      // on le dit clairement au lieu d'un « Erreur lors de la suppression ».
      const ShippingRate = require('../models/shippingRate.model');
      const ServiceRate = require('../models/serviceRate.model');
      const { ShippingPrice, ServicePrice, ContactFavori } = require('../models');
      const [nbTransport, nbService, nbAncienTransport, nbAncienService, nbContacts] = await Promise.all([
        ShippingRate.count({ where: { countryId: id } }),
        ServiceRate.count({ where: { countryId: id } }),
        ShippingPrice.count({ where: { countryId: id } }),
        ServicePrice.count({ where: { countryId: id } }),
        ContactFavori.count({ where: { pays_id: id } }),
      ]);
      const liens = [];
      if (nbTransport + nbAncienTransport) liens.push('des tarifs de transport');
      if (nbService + nbAncienService) liens.push('des tarifs de services');
      if (nbContacts) liens.push(`${nbContacts} contact(s) favori(s) de clients`);
      if (liens.length) {
        return {
          success: false,
          status: 409,
          message: `Impossible de supprimer ce pays : il a encore ${liens.join(' et ')}. Supprimez d'abord les tarifs, ou désactivez le pays.`,
        };
      }

      await country.destroy();

      return {
        success: true,
        message: 'Pays supprimé avec succès',
      };
    } catch (error) {
      logger.error('Erreur deleteCountry', { error: error.message });
      return {
        success: false,
        status: 500,
        message: 'Erreur lors de la suppression du pays',
      };
    }
  }
}

module.exports = CountryService;
