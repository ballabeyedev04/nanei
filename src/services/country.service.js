const Country = require('../models/country.model');
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

      const existingCountry = await Country.findOne({
        where: { code },
      });

      if (existingCountry) {
        return {
          success: false,
          message: 'Un pays avec ce code existe déjà',
        };
      }

      const country = await Country.create({
        name,
        code: code.toUpperCase(),
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

      if (code && code !== country.code) {
        const existingCountry = await Country.findOne({
          where: { code },
        });

        if (existingCountry) {
          return {
            success: false,
            message: 'Un pays avec ce code existe déjà',
          };
        }
      }

      await country.update({
        name: name || country.name,
        code: code ? code.toUpperCase() : country.code,
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
          message: 'Pays non trouvé',
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
        message: 'Erreur lors de la suppression du pays',
        error: error.message,
      };
    }
  }
}

module.exports = CountryService;
