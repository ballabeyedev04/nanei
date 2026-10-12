'use strict';

/**
 * Sessions : renouvellement (POST /auth/refresh), déconnexion, changement de
 * mot de passe (PUT /account/change-password) — par HTTP, routes réelles.
 *
 * ## Les défauts que ce test rend impossibles
 *
 * - Un refresh token rejouable : la rotation doit RÉVOQUER l'ancien et en
 *   émettre un nouveau, différent (avant le `jti`, une rotation dans la même
 *   seconde que la connexion produisait le MÊME jeton → violation d'unicité
 *   en base → 500).
 * - Un compte désactivé ou supprimé qui garde sa session tant que son refresh
 *   token est valide, ou un refresh token émis AVANT un changement de mot de
 *   passe qui continue de servir.
 * - Un changement de mot de passe qui laisse les autres appareils connectés,
 *   ou qui déconnecte l'appareil courant faute de lui renvoyer de nouveaux
 *   jetons (le mobile et l'admin enregistrent `token` + `refreshToken`).
 * - Le jeton renouvelé qui perd le contenu du jeton de connexion.
 */

jest.mock('../middlewares/rateLimit.middleware', () => {
  const passe = (req, res, next) => next();
  return new Proxy({}, { get: (_c, cle) => (cle === '__esModule' ? undefined : passe) });
});
jest.mock('../config/db', () => ({
  transaction: jest.fn(async (cb) => (typeof cb === 'function' ? cb({}) : { commit: jest.fn(), rollback: jest.fn() })),
  fn: jest.fn(), col: jest.fn(), where: jest.fn(),
}));
jest.mock('../models/utilisateur.model', () => ({ findOne: jest.fn(), findAll: jest.fn(), findByPk: jest.fn(), update: jest.fn() }));
jest.mock('../models/refreshToken.model', () => ({ create: jest.fn(async () => ({})), update: jest.fn(async () => [1]), findOne: jest.fn() }));
jest.mock('../config/security', () => ({ ...jest.requireActual('../config/security'), bcryptConfig: { saltRounds: 4 } }));

const crypto = require('crypto');
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const Utilisateur = require('../models/utilisateur.model');
const RefreshToken = require('../models/refreshToken.model');
const { jwtConfig } = require('../config/security');
const AuthService = require('../services/auth.service');

const app = express();
app.use(express.json());
app.use('/nanei/auth', require('../routes/auth.route'));
app.use('/nanei/account', require('../routes/account.route'));

const sha256 = (v) => crypto.createHash('sha256').update(v).digest('hex');
const ID = '11111111-1111-4111-8111-111111111111';

let HASH;
beforeAll(async () => { HASH = await bcrypt.hash('Ancien123', 4); });

const utilisateur = (s = {}) => ({
  id: ID, nom: 'Diallo', prenom: 'Awa', email: 'awa@test.ml', telephone: '+22376000000', adresse: '',
  role: 'Particulier', statut: 'actif', passwordChangedAt: null, mot_de_passe: HASH, photoProfil: null,
  save: jest.fn(async () => {}), ...s,
});

/** Refresh token authentique + son enregistrement en base (doublé). */
function refreshEnBase({ iat, expiresAt = new Date(Date.now() + 86400000) } = {}) {
  const charge = { id: ID, role: 'Particulier', jti: crypto.randomUUID() };
  if (iat) charge.iat = iat;
  const rt = jwt.sign(charge, jwtConfig.refreshSecret, { expiresIn: '7d' });
  const stored = { tokenHash: sha256(rt), expiresAt, update: jest.fn(async () => {}), destroy: jest.fn(async () => {}) };
  RefreshToken.findOne.mockImplementation(async ({ where }) => (where.tokenHash === stored.tokenHash && where.revoked === false ? stored : null));
  return { rt, stored };
}

describe('POST /nanei/auth/refresh', () => {
  it('corps sans refreshToken : 400 (validation)', async () => {
    expect((await request(app).post('/nanei/auth/refresh').send({})).status).toBe(400);
  });

  it('jeton inconnu ou déjà révoqué : 401', async () => {
    RefreshToken.findOne.mockResolvedValue(null);
    expect((await request(app).post('/nanei/auth/refresh').send({ refreshToken: 'nimporte' })).status).toBe(401);
  });

  it('enregistrement expiré : supprimé, 401', async () => {
    const { rt, stored } = refreshEnBase({ expiresAt: new Date(Date.now() - 1000) });
    expect((await request(app).post('/nanei/auth/refresh').send({ refreshToken: rt })).status).toBe(401);
    expect(stored.destroy).toHaveBeenCalled();
  });

  it('signature invalide (empreinte connue mais jeton forgé) : 401', async () => {
    const forge = jwt.sign({ id: ID }, 'autre-secret');
    const stored = { expiresAt: new Date(Date.now() + 1000), destroy: jest.fn(), update: jest.fn() };
    RefreshToken.findOne.mockResolvedValue(stored);
    expect((await request(app).post('/nanei/auth/refresh').send({ refreshToken: forge })).status).toBe(401);
  });

  it.each([
    ['compte désactivé', () => utilisateur({ statut: 'inactif' })],
    ['compte supprimé', () => null],
    ['mot de passe changé APRÈS l’émission du refresh token', () => utilisateur({ passwordChangedAt: new Date() })],
  ])('%s : session refusée et refresh token RÉVOQUÉ', async (_l, fabrique) => {
    const { rt, stored } = refreshEnBase({ iat: Math.floor(Date.now() / 1000) - 3600 });
    Utilisateur.findByPk.mockResolvedValue(fabrique());
    const r = await request(app).post('/nanei/auth/refresh').send({ refreshToken: rt });
    expect(r.status).toBe(401);
    expect(stored.update).toHaveBeenCalledWith({ revoked: true });
    expect(RefreshToken.create).not.toHaveBeenCalled();
  });

  it('succès : ROTATION — ancien révoqué, nouveau différent stocké haché, jeton d’accès complet', async () => {
    // Connexion puis renouvellement immédiat (même seconde) : le cas qui
    // produisait deux jetons identiques avant le `jti`.
    const login = await AuthService.genererRefreshToken(utilisateur());
    const stored = { tokenHash: sha256(login), expiresAt: new Date(Date.now() + 86400000), update: jest.fn(async () => {}), destroy: jest.fn() };
    RefreshToken.findOne.mockResolvedValue(stored);
    Utilisateur.findByPk.mockResolvedValue(utilisateur());
    RefreshToken.create.mockClear();

    const r = await request(app).post('/nanei/auth/refresh').send({ refreshToken: login });
    expect(r.status).toBe(200);
    expect(stored.update).toHaveBeenCalledWith({ revoked: true });
    expect(r.body.refreshToken).not.toBe(login);
    const nouveau = RefreshToken.create.mock.calls[0][0];
    expect(nouveau.tokenHash).toBe(sha256(r.body.refreshToken));
    expect(nouveau.tokenHash).not.toBe(stored.tokenHash);
    expect(jwt.verify(r.body.token, jwtConfig.secret)).toMatchObject({ id: ID, role: 'Particulier', email: 'awa@test.ml', nom: 'Diallo' });
  });
});

describe('POST /nanei/auth/logout', () => {
  it('révoque le refresh token présenté (par son empreinte)', async () => {
    const r = await request(app).post('/nanei/auth/logout').send({ refreshToken: 'abc' });
    expect(r.status).toBe(200);
    expect(RefreshToken.update).toHaveBeenCalledWith({ revoked: true }, { where: { tokenHash: sha256('abc') } });
  });

  it('sans refresh token : 200 quand même (déconnexion locale toujours possible)', async () => {
    expect((await request(app).post('/nanei/auth/logout').send({})).status).toBe(200);
    expect(RefreshToken.update).not.toHaveBeenCalled();
  });
});

describe('PUT /nanei/account/change-password', () => {
  const acces = () => jwt.sign({ id: ID, role: 'Particulier' }, jwtConfig.secret, { expiresIn: '5m' });

  it('ancien mot de passe faux : 400, rien n’est révoqué', async () => {
    const u = utilisateur();
    Utilisateur.findByPk.mockResolvedValue(u);
    const r = await request(app).put('/nanei/account/change-password')
      .set('Authorization', `Bearer ${acces()}`).send({ oldPassword: 'Faux1234', newPassword: 'Nouveau123' });
    expect(r.status).toBe(400);
    expect(r.body.message).toBe('Mot de passe actuel incorrect.');
    expect(RefreshToken.update).not.toHaveBeenCalled();
  });

  it('nouveau mot de passe faible : 400 (validation)', async () => {
    Utilisateur.findByPk.mockResolvedValue(utilisateur());
    const r = await request(app).put('/nanei/account/change-password')
      .set('Authorization', `Bearer ${acces()}`).send({ oldPassword: 'Ancien123', newPassword: 'faible' });
    expect(r.status).toBe(400);
  });

  it('succès : autres sessions révoquées, NOUVEAUX jetons renvoyés et utilisables tout de suite', async () => {
    const u = utilisateur();
    Utilisateur.findByPk.mockResolvedValue(u);
    const r = await request(app).put('/nanei/account/change-password')
      .set('Authorization', `Bearer ${acces()}`).send({ oldPassword: 'Ancien123', newPassword: 'Nouveau123' });
    expect(r.status).toBe(200);
    expect(await bcrypt.compare('Nouveau123', u.mot_de_passe)).toBe(true);
    expect(RefreshToken.update).toHaveBeenCalledWith({ revoked: true }, expect.objectContaining({ where: { utilisateurId: ID, revoked: false } }));
    expect(u.save).toHaveBeenCalled();
    expect(typeof r.body.token).toBe('string');
    expect(typeof r.body.refreshToken).toBe('string');

    // Le nouveau jeton d'accès passe le contrôle « émis après le changement »
    // d'auth.middleware ; un jeton émis une heure plus tôt ne le passe plus.
    const { iat } = jwt.decode(r.body.token);
    expect(iat * 1000).toBeGreaterThanOrEqual(u.passwordChangedAt.getTime());
    const me = await request(app).get('/nanei/account/me').set('Authorization', `Bearer ${r.body.token}`);
    expect(me.status).not.toBe(401);
    const vieux = jwt.sign({ id: ID, role: 'Particulier', iat: Math.floor(Date.now() / 1000) - 3600 }, jwtConfig.secret, { expiresIn: '2h' });
    expect((await request(app).get('/nanei/account/me').set('Authorization', `Bearer ${vieux}`)).status).toBe(401);
  });
});
