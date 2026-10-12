'use strict';

/**
 * Profil du compte connecté (services/account.service.js, PUT
 * /account/modifier-profil, GET /account/me).
 *
 * ## Les défauts que ce test rend impossibles
 *
 * - Un client qui VIDE son téléphone : avant, ignoré en silence (réponse 200
 *   trompeuse) alors que c'est un identifiant de connexion obligatoire.
 * - Deux comptes avec le même e-mail ou le même téléphone après une
 *   modification de profil.
 * - Le hash du mot de passe ou d'autres champs internes dans la réponse.
 * - Une « photo de profil » qui n'est pas une image (contrôle du contenu).
 */

jest.mock('../models/utilisateur.model', () => ({ findByPk: jest.fn(), findOne: jest.fn(), update: jest.fn() }));
jest.mock('../models/refreshToken.model', () => ({ create: jest.fn(), update: jest.fn() }));
jest.mock('../middlewares/rateLimit.middleware', () => {
  const passe = (req, res, next) => next();
  return new Proxy({}, { get: (_c, cle) => (cle === '__esModule' ? undefined : passe) });
});

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const sequelize = require('../config/db');
const Utilisateur = require('../models/utilisateur.model');
const AccountService = require('../services/account.service');
const { jwtConfig } = require('../config/security');
const r2 = require('../services/r2.service');
const errorHandler = require('../middlewares/errorHandler.middleware');

const t = { commit: jest.fn(async () => {}), rollback: jest.fn(async () => {}) };
beforeEach(() => { jest.spyOn(sequelize, 'transaction').mockResolvedValue(t); });

const ID = '11111111-1111-4111-8111-111111111111';
const moi = (s = {}) => ({
  id: ID, nom: 'Diallo', prenom: 'Awa', email: 'awa@test.ml', telephone: '+22376000000', adresse: 'Bamako',
  role: 'Particulier', statut: 'actif', mot_de_passe: 'HASH', fcm_token: 'FCM', passwordChangedAt: null, photoProfil: null,
  save: jest.fn(async () => {}), ...s,
});

describe('updateProfile', () => {
  it('client qui vide son téléphone : refusé (identifiant de connexion)', async () => {
    Utilisateur.findByPk.mockResolvedValue(moi());
    expect(await AccountService.updateProfile({ userId: ID, data: { telephone: '' } })).toEqual({ error: 'Le numéro de téléphone est obligatoire' });
    expect(t.rollback).toHaveBeenCalled();
  });

  it('admin qui vide son téléphone : autorisé (NULL)', async () => {
    const a = moi({ role: 'Admin' });
    Utilisateur.findByPk.mockResolvedValue(a);
    await AccountService.updateProfile({ userId: ID, data: { telephone: '' } });
    expect(a.telephone).toBeNull();
  });

  it('e-mail ou téléphone déjà pris par un autre compte : refusé', async () => {
    Utilisateur.findByPk.mockResolvedValue(moi());
    Utilisateur.findOne.mockResolvedValueOnce({ id: 'autre' });
    expect((await AccountService.updateProfile({ userId: ID, data: { email: 'pris@test.ml' } })).error).toBe('Cet email est déjà utilisé');
    Utilisateur.findOne.mockResolvedValueOnce({ id: 'autre' });
    expect((await AccountService.updateProfile({ userId: ID, data: { telephone: '+22370000000' } })).error).toBe('Ce numéro de téléphone est déjà utilisé');
  });
});

describe('HTTP — profil', () => {
  const app = express();
  app.use(express.json());
  app.use('/nanei/account', require('../routes/account.route'));
  app.use(errorHandler);
  const acces = jwt.sign({ id: ID, role: 'Particulier' }, jwtConfig.secret, { expiresIn: '5m' });

  it('GET /me : profil formaté, sans hash ni jeton push', async () => {
    Utilisateur.findByPk.mockResolvedValue(moi());
    const r = await request(app).get('/nanei/account/me').set('Authorization', `Bearer ${acces}`);
    expect(r.status).toBe(200);
    expect(r.body.utilisateur).toEqual({ id: ID, nom: 'Diallo', prenom: 'Awa', email: 'awa@test.ml', adresse: 'Bamako', telephone: '+22376000000', role: 'Particulier', statut: 'actif', photoProfil: null });
  });

  it('photo de profil dont le CONTENU n’est pas une image : 400, rien n’est envoyé', async () => {
    Utilisateur.findByPk.mockResolvedValue(moi());
    const r = await request(app).put('/nanei/account/modifier-profil').set('Authorization', `Bearer ${acces}`)
      .attach('photoProfil', Buffer.from('<?php system($_GET["c"]); ?>'), { filename: 'photo.jpg', contentType: 'image/jpeg' });
    expect(r.status).toBe(400);
    expect(r2.uploadImage).not.toHaveBeenCalled();
  });

  it('champ interdit (role) ignoré par la validation', async () => {
    const u = moi();
    Utilisateur.findByPk.mockResolvedValue(u);
    Utilisateur.findOne.mockResolvedValue(null);
    const r = await request(app).put('/nanei/account/modifier-profil').set('Authorization', `Bearer ${acces}`).send({ nom: 'Traoré', role: 'Admin' });
    expect(r.status).toBe(200);
    expect(u.role).toBe('Particulier');
    expect(u.nom).toBe('Traoré');
  });
});
