'use strict';

/**
 * Réclamations, avis et preuves de livraison (contrôleurs client + admin).
 *
 * ## Les défauts que ce test rend impossibles
 *
 * Réclamations
 * - Le commentaire de l'admin perdu (l'ancienne version de l'admin envoyait
 *   `commentaire`, le back lisait `commentaire_admin`) : les deux sont lus.
 * - Un statut inconnu enregistré (ou une erreur Postgres sur l'enum → 500) :
 *   400, en liste comme en mise à jour.
 * - HTML injecté dans l'e-mail envoyé au client (prénom saisi par le client,
 *   commentaire saisi par l'admin) ; retour à la ligne dans le sujet.
 * - Une réclamation sur le colis d'un autre ; un type inconnu.
 * Avis
 * - Stats calculées sur la seule page affichée ; filtre de note ignoré.
 * - Trouvé en écrivant ce test : une note « abc » ou 4.5 passait le contrôle
 *   (comparaisons fausses) puis échouait en base (500) ou était tronquée.
 * - Un avis sur un colis non livré, d'un autre, ou deux avis pour un colis.
 * Preuves
 * - Une preuve existante ÉCRASÉE sans confirmation (409 désormais, sauf
 *   `remplacer=true`), une preuve sur un colis non livré (409), une preuve
 *   visible par un tiers.
 */

jest.mock('../models', () => ({
  Colis: { findByPk: jest.fn() },
  Reclamation: { create: jest.fn(), findByPk: jest.fn(), findOne: jest.fn(), findAll: jest.fn(), findAndCountAll: jest.fn() },
  Avis: { findOne: jest.fn(), create: jest.fn(), findAll: jest.fn(), findAndCountAll: jest.fn() },
  PreuveLivraison: { findOne: jest.fn(), create: jest.fn(), sequelize: { transaction: jest.fn(async (cb) => cb({})) } },
  Utilisateur: {},
}));

const express = require('express');
const request = require('supertest');
const { Colis, Reclamation, Avis, PreuveLivraison } = require('../models');
const { sendEmail } = require('../services/resend.service');
const { sendSMS } = require('../services/sms.service');
const r2 = require('../services/r2.service');
const reclamation = require('../controllers/client/reclamation.controller');
const avis = require('../controllers/client/avis.controller');
const preuve = require('../controllers/admin/preuve.controller');
const errorHandler = require('../middlewares/errorHandler.middleware');

const MOI = 'u-moi';
const app = express();
app.use(express.json());
app.use((req, res, next) => { req.user = { id: MOI, role: req.headers['x-role'] || 'Particulier' }; next(); });
app.post('/reclamations', reclamation.upload.array('photos', 5), reclamation.creer);
app.get('/reclamations/:id', reclamation.detail);
app.get('/admin/reclamations', reclamation.adminList);
app.put('/admin/reclamations/:id', reclamation.adminUpdate);
app.post('/avis', avis.donnerAvis);
app.get('/admin/avis', avis.adminAvis);
app.post('/admin/colis/:colisId/preuve', preuve.upload.single('photo'), preuve.ajouterPreuve);
app.get('/colis/:colisId/preuve', preuve.voirPreuveClient);
app.use(errorHandler);

const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(32)]);

describe('réclamations — client', () => {
  it('colis d’un autre : 403', async () => {
    Colis.findByPk.mockResolvedValue({ expediteurId: 'x', recepteurId: 'y' });
    const r = await request(app).post('/reclamations').field('colis_id', 'c').field('type', 'perdu').field('description', 'd');
    expect(r.status).toBe(403);
  });

  it('le DESTINATAIRE peut réclamer ; « endommage » sans accent ramené à la valeur canonique ; photo vérifiée et envoyée sur R2', async () => {
    Colis.findByPk.mockResolvedValue({ expediteurId: 'x', recepteurId: MOI });
    Reclamation.create.mockImplementation(async (v) => ({ id: 'rec-1', ...v }));
    const r = await request(app).post('/reclamations')
      .field('colis_id', 'c').field('type', 'Endommage').field('description', 'Carton écrasé')
      .attach('photos', JPEG, { filename: 'p.jpg', contentType: 'image/jpeg' });
    expect(r.status).toBe(201);
    expect(Reclamation.create).toHaveBeenCalledWith(expect.objectContaining({ type: 'endommagé', utilisateur_id: MOI, photos: ['https://r2.test/nanei/reclamations/p.jpg'] }));
  });

  it('photo dont le contenu n’est pas une image : 400, rien n’est créé', async () => {
    Colis.findByPk.mockResolvedValue({ expediteurId: MOI, recepteurId: 'y' });
    const r = await request(app).post('/reclamations')
      .field('colis_id', 'c').field('type', 'perdu').field('description', 'd')
      .attach('photos', Buffer.from('<html>pas une image</html>'), { filename: 'p.jpg', contentType: 'image/jpeg' });
    expect(r.status).toBe(400);
    expect(Reclamation.create).not.toHaveBeenCalled();
    expect(r2.uploadImage).not.toHaveBeenCalled();
  });

  it('type inconnu ou champ manquant : 400', async () => {
    expect((await request(app).post('/reclamations').field('colis_id', 'c').field('type', 'vol').field('description', 'd')).status).toBe(400);
    expect((await request(app).post('/reclamations').field('colis_id', 'c').field('type', 'perdu')).status).toBe(400);
  });

  it('détail : uniquement SES réclamations', async () => {
    Reclamation.findOne.mockResolvedValue(null);
    expect((await request(app).get('/reclamations/r-x')).status).toBe(404);
    expect(Reclamation.findOne.mock.calls[0][0].where).toEqual({ id: 'r-x', utilisateur_id: MOI });
  });
});

describe('réclamations — admin', () => {
  const recl = () => ({
    id: 'rec-1', statut: 'ouverte', commentaire_admin: null,
    colis: { reference: 'COL-1' },
    utilisateur: { prenom: '<b>Awa</b>', email: 'awa@test.ml', telephone: '+22370000000' },
    save: jest.fn(async () => {}),
  });

  it('liste : statut inconnu → 400 ; statut connu → filtre', async () => {
    expect((await request(app).get('/admin/reclamations?statut=perdue')).status).toBe(400);
    Reclamation.findAll.mockResolvedValue([]);
    expect((await request(app).get('/admin/reclamations?statut=en_cours')).status).toBe(200);
    expect(Reclamation.findAll.mock.calls[0][0].where).toEqual({ statut: 'en_cours' });
  });

  it('mise à jour : statut inconnu → 400, rien n’est enregistré', async () => {
    const r0 = recl();
    Reclamation.findByPk.mockResolvedValue(r0);
    expect((await request(app).put('/admin/reclamations/rec-1').send({ statut: 'fermee' })).status).toBe(400);
    expect(r0.save).not.toHaveBeenCalled();
  });

  it.each([['commentaire_admin'], ['commentaire']])('le commentaire envoyé sous « %s » est enregistré', async (champ) => {
    const r0 = recl();
    Reclamation.findByPk.mockResolvedValue(r0);
    await request(app).put('/admin/reclamations/rec-1').send({ statut: 'resolue', [champ]: 'Remboursé' });
    expect(r0.commentaire_admin).toBe('Remboursé');
    expect(r0.statut).toBe('resolue');
  });

  it('e-mail au client : HTML ÉCHAPPÉ (prénom, commentaire), sujet sur une ligne ; SMS envoyé', async () => {
    const r0 = recl();
    r0.colis.reference = 'COL-1\r\nBcc: x@y.z';
    Reclamation.findByPk.mockResolvedValue(r0);
    await request(app).put('/admin/reclamations/rec-1').send({ statut: 'en_cours', commentaire_admin: '<a href="http://piege">cliquez</a>' });
    const { html, subject } = sendEmail.mock.calls[0][0];
    expect(html).not.toContain('<b>');
    expect(html).not.toContain('<a href');
    expect(html).toContain('&lt;a href=&quot;http://piege&quot;&gt;');
    expect(subject).not.toMatch(/[\r\n]/);
    expect(sendSMS).toHaveBeenCalledWith('+22370000000', expect.stringContaining('en cours de traitement'));
  });

  it('panne de l’e-mail : la mise à jour est tout de même confirmée', async () => {
    Reclamation.findByPk.mockResolvedValue(recl());
    sendEmail.mockRejectedValueOnce(new Error('Resend down'));
    expect((await request(app).put('/admin/reclamations/rec-1').send({ statut: 'rejetee' })).status).toBe(200);
  });
});

describe('avis', () => {
  beforeEach(() => {
    Colis.findByPk.mockResolvedValue({ expediteurId: MOI, statut: 'livre' });
    Avis.findOne.mockResolvedValue(null);
    Avis.create.mockImplementation(async (v) => v);
  });

  it.each([['abc'], [4.5], [0], [6], ['3.7']])('note %p refusée (400), rien n’est créé', async (note) => {
    const r = await request(app).post('/avis').send({ colis_id: 'c', note });
    expect(r.status).toBe(400);
    expect(Avis.create).not.toHaveBeenCalled();
  });

  it('note « 4 » (texte) acceptée, enregistrée en entier ; colisId accepté aussi', async () => {
    expect((await request(app).post('/avis').send({ colisId: 'c', note: '4' })).status).toBe(201);
    expect(Avis.create).toHaveBeenCalledWith(expect.objectContaining({ colis_id: 'c', note: 4 }));
  });

  it('colis non livré : 400 ; colis d’un autre : 403 ; avis déjà donné : 409', async () => {
    Colis.findByPk.mockResolvedValueOnce({ expediteurId: MOI, statut: 'recupere' });
    expect((await request(app).post('/avis').send({ colis_id: 'c', note: 5 })).status).toBe(400);
    Colis.findByPk.mockResolvedValueOnce({ expediteurId: 'autre', statut: 'livre' });
    expect((await request(app).post('/avis').send({ colis_id: 'c', note: 5 })).status).toBe(403);
    Avis.findOne.mockResolvedValueOnce({ id: 'deja' });
    expect((await request(app).post('/avis').send({ colis_id: 'c', note: 5 })).status).toBe(409);
  });

  it('admin : stats sur TOUS les avis (indépendantes du filtre), filtre ?note appliqué à la liste', async () => {
    Avis.findAll.mockImplementation(async (o) => (o.group
      ? [{ note: 5, nombre: '3' }, { note: 2, nombre: '1' }]
      : [{ id: 'a' }]));
    const r = await request(app).get('/admin/avis?note=5');
    expect(r.body.stats).toEqual({ total: 4, note_moyenne: 4.3, distribution: { 1: 0, 2: 1, 3: 0, 4: 0, 5: 3 } });
    const liste = Avis.findAll.mock.calls.find(([o]) => !o.group)[0];
    expect(liste.where).toEqual({ note: 5 });
  });

  it('admin : ?note invalide ignoré (liste complète)', async () => {
    Avis.findAll.mockResolvedValue([]);
    await request(app).get('/admin/avis?note=9');
    const liste = Avis.findAll.mock.calls.find(([o]) => !o.group)[0];
    expect(liste.where).toEqual({});
  });
});

describe('preuves de livraison', () => {
  const envoyer = (query = '') => request(app).post(`/admin/colis/c-1/preuve${query}`)
    .attach('photo', JPEG, { filename: 'preuve.jpg', contentType: 'image/jpeg' }).field('gps_lat', '12.6');

  it('colis non livré : 409, aucune photo envoyée', async () => {
    Colis.findByPk.mockResolvedValue({ id: 'c-1', statut: 'recupere' });
    expect((await envoyer()).status).toBe(409);
    expect(r2.uploadImage).not.toHaveBeenCalled();
  });

  it('preuve existante SANS `remplacer=true` : 409, rien n’est écrasé ni envoyé', async () => {
    Colis.findByPk.mockResolvedValue({ id: 'c-1', statut: 'livre' });
    const existante = { id: 'p-1', destroy: jest.fn() };
    PreuveLivraison.findOne.mockResolvedValue(existante);
    const r = await envoyer();
    expect(r.status).toBe(409);
    expect(r.body.preuve).toEqual({ id: 'p-1' });
    expect(existante.destroy).not.toHaveBeenCalled();
    expect(r2.uploadImage).not.toHaveBeenCalled();
  });

  it('preuve existante AVEC `remplacer=true` : remplacée (200)', async () => {
    Colis.findByPk.mockResolvedValue({ id: 'c-1', statut: 'livre' });
    const existante = { id: 'p-1', destroy: jest.fn(async () => {}) };
    PreuveLivraison.findOne.mockResolvedValue(existante);
    PreuveLivraison.create.mockImplementation(async (v) => v);
    const r = await envoyer('?remplacer=true');
    expect(r.status).toBe(200);
    expect(existante.destroy).toHaveBeenCalled();
  });

  it('première preuve : 201, coordonnées GPS en nombre', async () => {
    Colis.findByPk.mockResolvedValue({ id: 'c-1', statut: 'livre' });
    PreuveLivraison.findOne.mockResolvedValue(null);
    PreuveLivraison.create.mockImplementation(async (v) => v);
    const r = await envoyer();
    expect(r.status).toBe(201);
    expect(PreuveLivraison.create).toHaveBeenCalledWith(expect.objectContaining({ colis_id: 'c-1', gps_lat: 12.6, photo_url: expect.stringMatching(/\.jpg$/) }));
  });

  it('photo absente : 400', async () => {
    Colis.findByPk.mockResolvedValue({ id: 'c-1', statut: 'livre' });
    expect((await request(app).post('/admin/colis/c-1/preuve')).status).toBe(400);
  });

  it('client : preuve d’un colis tiers → 403', async () => {
    Colis.findByPk.mockResolvedValue({ expediteurId: 'x', recepteurId: 'y' });
    expect((await request(app).get('/colis/c-1/preuve')).status).toBe(403);
  });
});
