const ShippingPrice = require('../models/shippingPrice.model');
const ServicePrice = require('../models/servicePrice.model');
const Country = require('../models/country.model');
const ShippingRateService = require('./shippingRate.service');
const ServiceRateService = require('./serviceRate.service');
const logger = require('../config/logger');

// Normalise le type de transport saisi côté client : accepte « aérien »,
// « aerien », « AERIEN »… et renvoie la valeur canonique stockée en base.
function normaliserTypeTransport(type) {
  const t = String(type || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
  if (t === 'aerien') return 'aérien';
  if (t === 'maritime') return 'maritime';
  return null;
}

class PricingCalculatorService {

  /**
   * Grille tarifaire d'un pays — MÊME source que GET /client/pricing/:countryId
   * (écran d'envoi mobile) : nouvelles tables shipping_rates / service_rates
   * en priorité, anciennes tables shipping_prices / service_prices en repli
   * pour les pays pas encore migrés. Garantit que le prix calculé ici est
   * identique à celui affiché à l'utilisateur.
   */
  static async getGrille(countryId) {
    const rateData = await ShippingRateService.getPricingForCountry(countryId);
    const shippingPrices = rateData
      ? rateData.shippingPrices
      : (await ShippingPrice.findAll({
          where: { countryId },
          attributes: ['type', 'minWeight', 'maxWeight', 'pricePerKg'],
          order: [['type', 'ASC'], ['minWeight', 'ASC']],
          raw: true,
        }));

    const serviceData = await ServiceRateService.getServicesForCountry(countryId);
    const servicePrices = serviceData
      ? serviceData.servicePrices
      : (await ServicePrice.findAll({
          where: { countryId },
          attributes: ['serviceType', 'price'],
          raw: true,
        }));

    return { shippingPrices, servicePrices };
  }

  static async calculateTotalPrice(countryId, weight, type, needsPickup = false, needsDelivery = false) {
    try {
      const poids = Number(weight);
      if (!countryId || !Number.isFinite(poids) || poids <= 0 || !type) {
        return {
          success: false,
          message: 'Les paramètres countryId, weight (> 0) et shippingType sont obligatoires',
        };
      }

      const typeTransport = normaliserTypeTransport(type);
      if (!typeTransport) {
        return { success: false, message: 'Type de transport invalide (aérien ou maritime)' };
      }

      const country = await Country.findByPk(countryId);
      if (!country || country.isActive === false) {
        return { success: false, message: 'Pays non trouvé' };
      }

      const { shippingPrices, servicePrices } = await this.getGrille(countryId);

      const plages = shippingPrices
        .filter((p) => p.type === typeTransport)
        .sort((a, b) => Number(a.minWeight) - Number(b.minWeight));
      if (plages.length === 0) {
        return {
          success: false,
          message: 'Aucun prix trouvé pour le pays et le type de transport spécifiés',
        };
      }

      const plage = plages.find(
        (p) => poids >= Number(p.minWeight) && poids <= Number(p.maxWeight)
      );
      if (!plage) {
        return {
          success: false,
          message: `Aucune plage de poids ne correspond au poids de ${poids}kg`,
        };
      }

      const prixService = (serviceType) => {
        const s = servicePrices.find((p) => p.serviceType === serviceType);
        return s ? Number(s.price) || 0 : 0;
      };

      const shippingPrice = poids * Number(plage.pricePerKg);
      const pickupPrice = needsPickup ? prixService('récupération') : 0;
      const deliveryPrice = needsDelivery ? prixService('livraison') : 0;
      const total = shippingPrice + pickupPrice + deliveryPrice;

      return {
        success: true,
        data: {
          shippingPrice: parseFloat(shippingPrice.toFixed(2)),
          pickupPrice: parseFloat(pickupPrice.toFixed(2)),
          deliveryPrice: parseFloat(deliveryPrice.toFixed(2)),
          total: parseFloat(total.toFixed(2)),
          pricePerKg: Number(plage.pricePerKg),
          breakdown: {
            weight: poids,
            type: typeTransport,
            country: country.name,
            countryId: country.id,
            needsPickup: !!needsPickup,
            needsDelivery: !!needsDelivery,
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

PricingCalculatorService.normaliserTypeTransport = normaliserTypeTransport;

module.exports = PricingCalculatorService;
