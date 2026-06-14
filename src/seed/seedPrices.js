const sequelize = require('../config/db');
const Country = require('../models/country.model');
const ShippingPrice = require('../models/shippingPrice.model');
const ServicePrice = require('../models/servicePrice.model');

const seedPrices = async () => {
  try {
    console.log('Starting pricing seed...');

    // Synchronize models
    await sequelize.sync();

    // Countries to create
    const countries = [
      { name: 'Mali', code: 'ML' },
      { name: 'Sénégal', code: 'SN' },
      { name: 'Côte d\'Ivoire', code: 'CI' },
    ];

    // Create countries
    console.log('Creating countries...');
    const createdCountries = [];
    for (const countryData of countries) {
      const [country] = await Country.findOrCreate({
        where: { code: countryData.code },
        defaults: { ...countryData, isActive: true },
      });
      createdCountries.push(country);
      console.log(`Country created/found: ${country.name}`);
    }

    // Shipping prices data (aérien and maritime by weight ranges)
    const shippingPricesData = [
      // Mali - Aérien
      { countryCode: 'ML', type: 'aérien', minWeight: 0.1, maxWeight: 5, pricePerKg: 15 },
      { countryCode: 'ML', type: 'aérien', minWeight: 5.1, maxWeight: 10, pricePerKg: 12 },
      { countryCode: 'ML', type: 'aérien', minWeight: 10.1, maxWeight: 20, pricePerKg: 10 },
      { countryCode: 'ML', type: 'aérien', minWeight: 20.1, maxWeight: 50, pricePerKg: 8 },
      // Mali - Maritime
      { countryCode: 'ML', type: 'maritime', minWeight: 0.1, maxWeight: 10, pricePerKg: 8 },
      { countryCode: 'ML', type: 'maritime', minWeight: 10.1, maxWeight: 20, pricePerKg: 6 },
      { countryCode: 'ML', type: 'maritime', minWeight: 20.1, maxWeight: 50, pricePerKg: 4 },
      { countryCode: 'ML', type: 'maritime', minWeight: 50.1, maxWeight: 100, pricePerKg: 2 },

      // Sénégal - Aérien
      { countryCode: 'SN', type: 'aérien', minWeight: 0.1, maxWeight: 5, pricePerKg: 14 },
      { countryCode: 'SN', type: 'aérien', minWeight: 5.1, maxWeight: 10, pricePerKg: 11 },
      { countryCode: 'SN', type: 'aérien', minWeight: 10.1, maxWeight: 20, pricePerKg: 9 },
      { countryCode: 'SN', type: 'aérien', minWeight: 20.1, maxWeight: 50, pricePerKg: 7 },
      // Sénégal - Maritime
      { countryCode: 'SN', type: 'maritime', minWeight: 0.1, maxWeight: 10, pricePerKg: 7 },
      { countryCode: 'SN', type: 'maritime', minWeight: 10.1, maxWeight: 20, pricePerKg: 5 },
      { countryCode: 'SN', type: 'maritime', minWeight: 20.1, maxWeight: 50, pricePerKg: 3 },
      { countryCode: 'SN', type: 'maritime', minWeight: 50.1, maxWeight: 100, pricePerKg: 1.5 },

      // Côte d'Ivoire - Aérien
      { countryCode: 'CI', type: 'aérien', minWeight: 0.1, maxWeight: 5, pricePerKg: 16 },
      { countryCode: 'CI', type: 'aérien', minWeight: 5.1, maxWeight: 10, pricePerKg: 13 },
      { countryCode: 'CI', type: 'aérien', minWeight: 10.1, maxWeight: 20, pricePerKg: 11 },
      { countryCode: 'CI', type: 'aérien', minWeight: 20.1, maxWeight: 50, pricePerKg: 9 },
      // Côte d'Ivoire - Maritime
      { countryCode: 'CI', type: 'maritime', minWeight: 0.1, maxWeight: 10, pricePerKg: 9 },
      { countryCode: 'CI', type: 'maritime', minWeight: 10.1, maxWeight: 20, pricePerKg: 7 },
      { countryCode: 'CI', type: 'maritime', minWeight: 20.1, maxWeight: 50, pricePerKg: 5 },
      { countryCode: 'CI', type: 'maritime', minWeight: 50.1, maxWeight: 100, pricePerKg: 3 },
    ];

    // Create shipping prices
    console.log('Creating shipping prices...');
    for (const priceData of shippingPricesData) {
      const country = createdCountries.find(c => c.code === priceData.countryCode);
      const [price] = await ShippingPrice.findOrCreate({
        where: {
          countryId: country.id,
          type: priceData.type,
          minWeight: priceData.minWeight,
          maxWeight: priceData.maxWeight,
        },
        defaults: {
          countryId: country.id,
          type: priceData.type,
          minWeight: priceData.minWeight,
          maxWeight: priceData.maxWeight,
          pricePerKg: priceData.pricePerKg,
        },
      });
      console.log(`Shipping price created/found: ${country.name} - ${priceData.type} (${priceData.minWeight}-${priceData.maxWeight}kg) @ ${priceData.pricePerKg}€/kg`);
    }

    // Service prices (récupération and livraison)
    const servicePricesData = [
      // Mali
      { countryCode: 'ML', serviceType: 'récupération', price: 5 },
      { countryCode: 'ML', serviceType: 'livraison', price: 5 },
      // Sénégal
      { countryCode: 'SN', serviceType: 'récupération', price: 5 },
      { countryCode: 'SN', serviceType: 'livraison', price: 5 },
      // Côte d'Ivoire
      { countryCode: 'CI', serviceType: 'récupération', price: 5 },
      { countryCode: 'CI', serviceType: 'livraison', price: 5 },
    ];

    // Create service prices
    console.log('Creating service prices...');
    for (const priceData of servicePricesData) {
      const country = createdCountries.find(c => c.code === priceData.countryCode);
      const [price] = await ServicePrice.findOrCreate({
        where: {
          serviceType: priceData.serviceType,
          countryId: country.id,
        },
        defaults: {
          serviceType: priceData.serviceType,
          countryId: country.id,
          price: priceData.price,
        },
      });
      console.log(`Service price created/found: ${country.name} - ${priceData.serviceType} @ ${priceData.price}€`);
    }

    console.log('Pricing seed completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding prices:', error);
    process.exit(1);
  }
};

// Run seed
seedPrices();
