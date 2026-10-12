'use strict';

/**
 * Calcul du prix (services/pricingCalculator.service.js) et grilles tarifaires
 * administrables (shippingRate, serviceRate, shippingPrice, servicePrice,
 * tauxChange).
 *
 * ## Les défauts que ce test rend impossibles
 *
 * - Un prix calculé à partir d'une autre grille que celle affichée au client
 *   (nouvelles tables shipping_rates / service_rates prioritaires, anciennes
 *   en repli), ou un poids hors plage facturé quand même.
 * - Un pays désactivé encore facturable.
 * - Des valeurs non numériques, négatives ou des plages vides enregistrées
 *   dans une grille. Trouvés en écrivant ce test : les anciennes grilles
 *   (shipping-prices / service-prices) n'avaient AUCUN contrôle numérique et
 *   comparaient les poids comme des CHAÎNES (« 10 » >= « 9 » est faux) ; la
 *   mise à jour partielle d'un tarif par pays (ne changer que le max)
 *   enregistrait une plage vide ; « Infinity » passait pour un taux de change.
 * - Trouvé en écrivant ce test : `statutEchec` n'était pas importé dans les
 *   contrôleurs shipping-rates / service-rates / taux-change → chaque refus
 *   (404, 400) finissait en ReferenceError, donc en 500.
 */

jest.mock('../models/country.model', () => ({ findByPk: jest.fn() }));
jest.mock('../models/shippingRate.model', () => ({ findOne: jest.fn(), findByPk: jest.fn(), findAll: jest.fn(), create: jest.fn() }));
jest.mock('../models/serviceRate.model', () => ({ findOne: jest.fn(), findByPk: jest.fn(), findAll: jest.fn(), create: jest.fn() }));
jest.mock('../models/shippingPrice.model', () => ({ findOne: jest.fn(), findByPk: jest.fn(), findAll: jest.fn(), create: jest.fn() }));
jest.mock('../models/servicePrice.model', () => ({ findOne: jest.fn(), findByPk: jest.fn(), findAll: jest.fn(), create: jest.fn() }));
jest.mock('../models/tauxChange.model', () => ({ findOne: jest.fn(), findByPk: jest.fn(), findAll: jest.fn() }));

const express = require('express');
const request = require('supertest');
const Country = require('../models/country.model');
const ShippingRate = require('../models/shippingRate.model');
const ServiceRate = require('../models/serviceRate.model');
const ShippingPrice = require('../models/shippingPrice.model');
const ServicePrice = require('../models/servicePrice.model');
const TauxChange = require('../models/tauxChange.model');
const Pricing = require('../services/pricingCalculator.service');
const ShippingRateService = require('../services/shippingRate.service');
const ServiceRateService = require('../services/serviceRate.service');
const ShippingPriceService = require('../services/shippingPrice.service');
const ServicePriceService = require('../services/servicePrice.service');
const TauxChangeService = require('../services/tauxChange.service');

const FRANCE = { id: 'fr', name: 'France', code: 'FRA', isActive: true };
const TARIF = {
  id: 't-1', countryId: 'fr', country: FRANCE,
  minWeightAerien: 1, maxWeightAerien: 30, priceAerienPerKg: 8,
  minWeightMaritime: 10, maxWeightMaritime: 500, priceMaritimePerKg: 2.5,
  update: jest.fn(async () => {}),
};

describe('calculateTotalPrice', () => {
  beforeEach(() => {
    Country.findByPk.mockResolvedValue(FRANCE);
    ShippingRate.findOne.mockResolvedValue(TARIF);
    ServiceRate.findOne.mockResolvedValue({ prixRecuperation: 5, prixLivraison: 7.5 });
  });

  it('poids × prix au kg de la plage + récupération + livraison (grille shipping_rates)', async () => {
    const r = await Pricing.calculateTotalPrice('fr', 2.5, 'aérien', true, true);
    expect(r.data).toMatchObject({ shippingPrice: 20, pickupPrice: 5, deliveryPrice: 7.5, total: 32.5, pricePerKg: 8 });
    expect(r.data.breakdown).toMatchObject({ type: 'aérien', country: 'France', countryId: 'fr' });
  });

  it('« AERIEN », « Aérien », « aerien » : même tarif ; maritime distinct', async () => {
    const a = await Pricing.calculateTotalPrice('fr', 10, 'AERIEN');
    const b = await Pricing.calculateTotalPrice('fr', 10, 'Aérien');
    const m = await Pricing.calculateTotalPrice('fr', 10, 'maritime');
    expect(a.data.total).toBe(80);
    expect(b.data.total).toBe(80);
    expect(m.data.total).toBe(25);
  });

  it('repli sur les anciennes tables quand le pays n’a pas de tarif unifié', async () => {
    ShippingRate.findOne.mockResolvedValue(null);
    ServiceRate.findOne.mockResolvedValue(null);
    ShippingPrice.findAll.mockResolvedValue([{ type: 'aérien', minWeight: 0, maxWeight: 5, pricePerKg: 10 }]);
    ServicePrice.findAll.mockResolvedValue([{ serviceType: 'livraison', price: 3 }]);
    expect((await Pricing.calculateTotalPrice('fr', 2, 'aerien', false, true)).data.total).toBe(23);
  });

  it.each([
    ['poids hors plage', ['fr', 31, 'aerien'], /Aucune plage de poids/],
    ['poids nul', ['fr', 0, 'aerien'], /obligatoires/],
    ['poids non numérique', ['fr', 'lourd', 'aerien'], /obligatoires/],
    ['type inconnu', ['fr', 2, 'fusée'], /Type de transport invalide/],
  ])('%s : refus', async (_l, args, message) => {
    const r = await Pricing.calculateTotalPrice(...args);
    expect(r.success).toBe(false);
    expect(r.message).toMatch(message);
  });

  it('pays désactivé ou inconnu : « Pays non trouvé »', async () => {
    Country.findByPk.mockResolvedValue({ ...FRANCE, isActive: false });
    expect((await Pricing.calculateTotalPrice('fr', 2, 'aerien')).message).toBe('Pays non trouvé');
    Country.findByPk.mockResolvedValue(null);
    expect((await Pricing.calculateTotalPrice('xx', 2, 'aerien')).message).toBe('Pays non trouvé');
  });
});

describe('tarif unifié par pays (shipping-rates)', () => {
  const COMPLET = { countryId: 'fr', minWeightAerien: 1, maxWeightAerien: 30, priceAerienPerKg: 8, minWeightMaritime: 10, maxWeightMaritime: 500, priceMaritimePerKg: 2 };

  it.each([
    ['prix « 4,75 »', { priceAerienPerKg: '4,75' }],
    ['prix négatif', { priceMaritimePerKg: -1 }],
    ['poids max nul', { maxWeightAerien: 0 }],
    ['min >= max', { minWeightMaritime: 600 }],
  ])('création — %s : refus', async (_l, s) => {
    Country.findByPk.mockResolvedValue(FRANCE);
    ShippingRate.findOne.mockResolvedValue(null);
    expect((await ShippingRateService.create({ ...COMPLET, ...s })).success).toBe(false);
    expect(ShippingRate.create).not.toHaveBeenCalled();
  });

  it('création — un seul tarif par pays', async () => {
    Country.findByPk.mockResolvedValue(FRANCE);
    ShippingRate.findOne.mockResolvedValue(TARIF);
    expect((await ShippingRateService.create(COMPLET)).message).toMatch(/existe déjà/);
  });

  it('mise à jour PARTIELLE : la plage finale (saisie + existant) est contrôlée', async () => {
    ShippingRate.findByPk.mockResolvedValue({ ...TARIF, update: jest.fn() });
    const r = await ShippingRateService.update('t-1', { maxWeightAerien: 0.5 }); // min existant = 1
    expect(r).toEqual({ success: false, message: 'Poids min aérien doit être < poids max aérien' });
  });

  it('mise à jour : le pays ne change jamais', async () => {
    const tarif = { ...TARIF, update: jest.fn(async () => {}) };
    ShippingRate.findByPk.mockResolvedValue(tarif);
    await ShippingRateService.update('t-1', { countryId: 'autre', priceAerienPerKg: 9 });
    expect(tarif.update.mock.calls[0][0]).not.toHaveProperty('countryId');
    expect(tarif.update.mock.calls[0][0].priceAerienPerKg).toBe(9);
  });
});

describe('tarif de services par pays (service-rates)', () => {
  it('valeurs non numériques ou négatives refusées', async () => {
    expect((await ServiceRateService.create({ countryId: 'fr', prixRecuperation: 'abc', prixLivraison: 2 })).success).toBe(false);
    ServiceRate.findByPk.mockResolvedValue({ update: jest.fn() });
    expect((await ServiceRateService.update('s', { prixLivraison: -3 })).success).toBe(false);
  });
});

describe('anciennes grilles (shipping-prices / service-prices)', () => {
  beforeEach(() => {
    Country.findByPk.mockResolvedValue(FRANCE);
    ShippingPrice.findOne.mockResolvedValue(null);
    ServicePrice.findOne.mockResolvedValue(null);
  });

  it('poids comparés comme des NOMBRES (« 10 » < « 9 » en texte)', async () => {
    const r = await ShippingPriceService.createShippingPrice({ countryId: 'fr', type: 'aérien', minWeight: '10', maxWeight: '9', pricePerKg: '3' });
    expect(r).toEqual({ success: false, message: 'Le poids minimum doit être inférieur au poids maximum' });
  });

  it.each([
    [{ pricePerKg: '-2' }], [{ pricePerKg: 'gratuit' }], [{ minWeight: '' }], [{ maxWeight: '1,5' }],
  ])('création refusée : %p', async (s) => {
    const r = await ShippingPriceService.createShippingPrice({ countryId: 'fr', type: 'aérien', minWeight: 0, maxWeight: 5, pricePerKg: 3, ...s });
    expect(r.success).toBe(false);
    expect(ShippingPrice.create).not.toHaveBeenCalled();
  });

  it('création valide acceptée', async () => {
    ShippingPrice.create.mockResolvedValue({ id: 'p' });
    ShippingPrice.findByPk.mockResolvedValue({ id: 'p' });
    expect((await ShippingPriceService.createShippingPrice({ countryId: 'fr', type: 'maritime', minWeight: 0, maxWeight: 5, pricePerKg: 3 })).success).toBe(true);
  });

  it('mise à jour : prix négatif ou type inconnu refusés', async () => {
    ShippingPrice.findByPk.mockResolvedValue({ id: 'p', minWeight: 0, maxWeight: 5, type: 'aérien', update: jest.fn() });
    expect((await ShippingPriceService.updateShippingPrice('p', { pricePerKg: -1 })).success).toBe(false);
    expect((await ShippingPriceService.updateShippingPrice('p', { type: 'fusée' })).success).toBe(false);
    expect((await ShippingPriceService.updateShippingPrice('p', { maxWeight: 0 })).success).toBe(false);
  });

  it('création groupée : prix non numérique refusé', async () => {
    expect((await ShippingPriceService.createOrUpdateBulk({ countryId: 'fr', minWeight: 0, maxWeight: 5, aerienPricePerKg: 'x', maritimePricePerKg: 2 })).success).toBe(false);
  });

  it('prix de service négatif ou non numérique refusé', async () => {
    expect((await ServicePriceService.createServicePrice({ serviceType: 'livraison', countryId: 'fr', price: -5 })).success).toBe(false);
    ServicePrice.findByPk.mockResolvedValue({ id: 's', update: jest.fn() });
    expect((await ServicePriceService.updateServicePrice('s', { price: 'abc' })).success).toBe(false);
  });
});

describe('taux de change EUR → FCFA', () => {
  it.each([['0'], [-1], ['abc'], ['Infinity'], [''], [true], [undefined]])('valeur %p refusée', async (valeur) => {
    TauxChange.findByPk.mockResolvedValue({ update: jest.fn() });
    expect((await TauxChangeService.update('t', { valeur })).success).toBe(false);
  });

  it('valeur valide enregistrée en nombre', async () => {
    const taux = { update: jest.fn(async () => {}) };
    TauxChange.findByPk.mockResolvedValue(taux);
    expect((await TauxChangeService.update('t', { valeur: '656.5' })).success).toBe(true);
    expect(taux.update).toHaveBeenCalledWith({ valeur: 656.5 });
  });

  it('taux actif : celui de la base, sinon le taux fixe officiel 655.957', async () => {
    TauxChange.findOne.mockResolvedValue({ valeur: 660 });
    expect(await TauxChangeService.getTauxActif()).toBe(660);
    TauxChange.findOne.mockResolvedValue(null);
    expect(await TauxChangeService.getTauxActif()).toBe(655.957);
  });
});

describe('contrôleurs admin : un refus garde son code HTTP (import statutEchec)', () => {
  const app = express();
  app.use(express.json());
  const rates = require('../controllers/admin/shippingRate.controller');
  const services = require('../controllers/admin/serviceRate.controller');
  const taux = require('../controllers/admin/tauxChange.controller');
  app.get('/sr/:id', rates.getById);
  app.put('/sr/:id', rates.update);
  app.delete('/sr/:id', rates.delete);
  app.get('/sv/:id', services.getById);
  app.post('/sv', services.create);
  app.get('/tx/:id', taux.getById);
  app.put('/tx/:id', taux.update);

  it.each([
    ['get', '/sr/inconnu', 404],
    ['put', '/sr/inconnu', 404],
    ['delete', '/sr/inconnu', 404],
    ['get', '/sv/inconnu', 404],
    ['get', '/tx/inconnu', 404],
    ['put', '/tx/inconnu', 404],
  ])('%s %s → %i (avant : 500 ReferenceError)', async (methode, url, code) => {
    ShippingRate.findByPk.mockResolvedValue(null);
    ServiceRate.findByPk.mockResolvedValue(null);
    TauxChange.findByPk.mockResolvedValue(null);
    expect((await request(app)[methode](url).send({})).status).toBe(code);
  });

  it('POST service-rates incomplet → 400', async () => {
    expect((await request(app).post('/sv').send({ countryId: 'fr' })).status).toBe(400);
  });

  it('PUT taux-change valeur invalide → 400', async () => {
    TauxChange.findByPk.mockResolvedValue({ update: jest.fn() });
    expect((await request(app).put('/tx/t').send({ valeur: 'abc' })).status).toBe(400);
  });
});
