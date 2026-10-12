'use strict';

/**
 * Parcours de bout en bout sur PostgreSQL RÉEL (base jetable, voir _base.js).
 * Sauté sans NANEI_TEST_DB_NAME.
 *
 * ## Ce que ce test prouve que les tests unitaires (mocks) ne prouvent pas
 *
 * Que les requêtes Sequelize réelles (contraintes, enums, `include`,
 * `distinct`, `GROUP BY` des compteurs, ILIKE échappé, transactions) font ce
 * que les doublures supposent, sur tout le parcours :
 *
 *   inscription → connexion → l'admin crée un pays et son tarif → le client
 *   envoie un colis (prix recalculé serveur, destinataire saisi à la main) →
 *   l'admin change le statut (puis 409 au second essai) → liste paginée du
 *   client (statut, pagination, par_statut) → suivi public (historique) →
 *   le destinataire s'inscrit et REVENDIQUE son compte automatique, et
 *   retrouve le colis dans ses colis reçus.
 *
 * Les services externes restent doublés (helpers/doublures.js) ; les
 * limiteurs de débit sont neutralisés (toutes les requêtes partent de la
 * même IP).
 */

const { configurerBaseIntegration } = require('./_base');

const ACTIF = configurerBaseIntegration();
const decrire = ACTIF ? describe : describe.skip;

jest.mock('../../middlewares/rateLimit.middleware', () => {
  const passe = (req, res, next) => next();
  return new Proxy({}, { get: (_c, cle) => (cle === '__esModule' ? undefined : passe) });
});

decrire('parcours complet — PostgreSQL réel', () => {
  const request = require('supertest');
  const bcrypt = require('bcrypt');
  const app = require('../../app');
  const sequelize = require('../../config/db');
  const { Utilisateur, Colis } = require('../../models');
  require('../../models/userOtp.model');
  require('../../models/refreshToken.model');

  const suffixe = Date.now().toString(36);
  const CLIENT = { nom: 'Diallo', prenom: 'Awa', email: `awa-${suffixe}@test.ml`, mot_de_passe: 'Secret123', telephone: `+2237${String(Date.now()).slice(-7)}` };
  const DESTINATAIRE_TEL = `+3361${String(Date.now()).slice(-7)}`;
  const ADMIN_MDP = 'AdminTest1!';
  let jetonClient;
  let jetonAdmin;
  let colis;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    await Utilisateur.create({
      nom: 'Admin', prenom: 'Test', email: `admin-${suffixe}@test.ml`, adresse: '',
      mot_de_passe: await bcrypt.hash(ADMIN_MDP, 4), role: 'Admin', statut: 'actif',
    });
  });

  afterAll(async () => { await sequelize.close(); });

  const avec = (jeton) => (req) => req.set('Authorization', `Bearer ${jeton}`);

  it('inscription puis connexion du client', async () => {
    const inscription = await request(app).post('/nanei/auth/register').send(CLIENT);
    expect(inscription.status).toBe(201);
    expect(inscription.body.utilisateur).not.toHaveProperty('mot_de_passe');

    const connexion = await request(app).post('/nanei/auth/login').send({ identifiant: CLIENT.email.toUpperCase(), mot_de_passe: CLIENT.mot_de_passe });
    expect(connexion.status).toBe(200);
    jetonClient = connexion.body.token;

    const admin = await request(app).post('/nanei/auth/login').send({ identifiant: `admin-${suffixe}@test.ml`, mot_de_passe: ADMIN_MDP });
    expect(admin.status).toBe(200);
    jetonAdmin = admin.body.token;
  });

  it('l’admin crée un pays et sa grille ; un client ne le peut pas', async () => {
    expect((await avec(jetonClient)(request(app).post('/nanei/admin/countries')).send({ name: 'Pirate', code: 'PIR' })).status).toBe(403);

    const pays = await avec(jetonAdmin)(request(app).post('/nanei/admin/countries')).send({ name: 'France', code: 'fra' });
    expect(pays.status).toBe(201);
    expect(pays.body.data.code).toBe('FRA');
    const doublon = await avec(jetonAdmin)(request(app).post('/nanei/admin/countries')).send({ name: 'france', code: 'FRX' });
    expect(doublon.status).toBe(400);

    const tarif = await avec(jetonAdmin)(request(app).post('/nanei/admin/shipping-rates')).send({
      countryId: pays.body.data.id, minWeightAerien: 0.5, maxWeightAerien: 30, priceAerienPerKg: 8,
      minWeightMaritime: 10, maxWeightMaritime: 500, priceMaritimePerKg: 2,
    });
    expect(tarif.status).toBe(201);
    const services = await avec(jetonAdmin)(request(app).post('/nanei/admin/service-rates')).send({ countryId: pays.body.data.id, prixRecuperation: 5, prixLivraison: 7 });
    expect(services.status).toBe(201);
    colis = { countryId: pays.body.data.id };
  });

  it('le client envoie un colis : prix RECALCULÉ serveur, transport canonique, destinataire léger créé', async () => {
    const r = await avec(jetonClient)(request(app).post('/nanei/client/envoie-colis')).send({
      destinataireManuel: { prenom: 'Issa', nom: 'Traoré', telephone: DESTINATAIRE_TEL, ville: 'Paris' },
      poids: 2, prix: 1, destination: 'ignorée', type_colis: 'Vêtements',
      countryId: colis.countryId, shippingType: 'Aérien', needsPickup: true, needsDelivery: false,
    });
    expect(r.status).toBe(201);
    expect(r.body.colis.prix).toBe(21); // 2 kg × 8 € + 5 € de récupération
    expect(r.body.colis.type_transport).toBe('aerien');
    expect(r.body.colis.destination).toBe('France');
    colis = r.body.colis;
    const recepteur = await Utilisateur.findByPk(colis.recepteurId);
    expect(recepteur).toMatchObject({ statut: 'inactif', compteAuto: true });
  });

  it('l’admin passe le colis à « récupéré » ; le même changement une 2e fois → 409', async () => {
    const url = `/nanei/admin/changer-statut-recupere/${colis.id}`;
    expect((await avec(jetonAdmin)(request(app).put(url))).status).toBe(200);
    expect((await avec(jetonAdmin)(request(app).put(url))).status).toBe(409);
    expect((await Colis.findByPk(colis.id)).statut).toBe('recupere');
  });

  it('liste paginée du client : filtre statut, pagination, compteurs sur tous les colis', async () => {
    const r = await avec(jetonClient)(request(app).get('/nanei/client/colis-envoyes?page=1&limit=1&statut=recupere'));
    expect(r.status).toBe(200);
    expect(r.body.data).toHaveLength(1);
    expect(r.body.data[0].statut).toBe('recupere');
    expect(r.body.pagination).toEqual({ page: 1, limit: 1, total: 1, pages: 1 });
    expect(r.body.par_statut).toEqual({ en_attente: 0, recupere: 1, livre: 0, total: 1 });

    const vide = await avec(jetonClient)(request(app).get('/nanei/client/colis-envoyes?statut=livre'));
    expect(vide.body.data).toEqual([]);
  });

  it('suivi public : historique du changement, téléphones masqués', async () => {
    const r = await request(app).get(`/nanei/suivi/${colis.reference}?format=json`);
    expect(r.status).toBe(200);
    expect(r.body.colis.historique.map((h) => h.nouveau_statut)).toEqual(['recupere']);
    expect(r.body.colis.recepteur.telephone).toMatch(/\*\*\*\*/);
  });

  it('le destinataire s’inscrit avec son téléphone : il REVENDIQUE le compte et voit le colis reçu', async () => {
    const inscription = await request(app).post('/nanei/auth/register').send({
      nom: 'Traoré', prenom: 'Issa', email: `issa-${suffixe}@test.ml`, mot_de_passe: 'Secret123', telephone: DESTINATAIRE_TEL,
    });
    expect(inscription.status).toBe(201);
    expect(inscription.body.utilisateur.id).toBe(colis.recepteurId);

    const connexion = await request(app).post('/nanei/auth/login').send({ identifiant: DESTINATAIRE_TEL, mot_de_passe: 'Secret123' });
    expect(connexion.status).toBe(200);
    const recus = await avec(connexion.body.token)(request(app).get('/nanei/client/colis-recus'));
    expect(recus.body.data.map((c) => c.reference)).toEqual([colis.reference]);
  });
});
