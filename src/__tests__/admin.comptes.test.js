'use strict';

/**
 * Comptes : gestion des admins, des clients, suppression RGPD, pays, et
 * formulaire du support.
 *
 * ## Les défauts que ce test rend impossibles
 *
 * - Plus personne pour administrer : un admin qui se désactive lui-même, ou
 *   la désactivation / suppression RGPD du DERNIER admin actif.
 * - Les routes « clients » utilisées pour (dés)activer un ADMIN, contournant
 *   ces garde-fous.
 * - Les comptes destinataires créés automatiquement (`compteAuto`) comptés et
 *   listés comme des clients inscrits, ou ACTIVÉS par un admin (la personne
 *   ne pourrait plus s'inscrire : « e-mail déjà utilisé », sans mot de passe).
 * - Un hash de mot de passe, un jeton ou un OTP renvoyé dans une réponse JSON.
 * - RGPD : un compte « supprimé » qui garde nom, e-mail, téléphone, photo,
 *   jeton push ou une session ; des colis supprimés avec lui (comptabilité,
 *   litiges du destinataire).
 * - Pays : doublon de nom (casse) ou de code (« fra » / « FRA ») ; suppression
 *   d'un pays encore utilisé (409 explicite au lieu d'une erreur de clé).
 * - Support : e-mail invalide ou objet trop long qui finissent en 500.
 */

jest.mock('../models/utilisateur.model', () => {
  const M = { findByPk: jest.fn(), findOne: jest.fn(), findAll: jest.fn(), findAndCountAll: jest.fn(), count: jest.fn(), create: jest.fn() };
  M.CHAMPS_PRIVES = ['mot_de_passe', 'resetPasswordToken', 'resetPasswordExpires', 'passwordChangedAt', 'otpCode', 'otpExpires', 'fcm_token'];
  return M;
});
jest.mock('../models', () => ({
  Utilisateur: jest.requireMock('../models/utilisateur.model'),
  Notifications: { destroy: jest.fn() }, Avis: { destroy: jest.fn() }, Reclamation: { destroy: jest.fn() },
  ContactFavori: { destroy: jest.fn(), count: jest.fn(async () => 0) }, RefreshToken: { destroy: jest.fn() },
  ShippingPrice: { count: jest.fn(async () => 0) }, ServicePrice: { count: jest.fn(async () => 0) },
}));
jest.mock('../models/country.model', () => ({ findOne: jest.fn(), findByPk: jest.fn(), findAll: jest.fn(), create: jest.fn() }));
jest.mock('../models/shippingRate.model', () => ({ count: jest.fn(async () => 0) }));
jest.mock('../models/serviceRate.model', () => ({ count: jest.fn(async () => 0) }));
jest.mock('../models/messageClient.model', () => ({ create: jest.fn(async (v) => ({ id: 'm-1', ...v })) }));

const { Op } = require('sequelize');
const express = require('express');
const request = require('supertest');
const Utilisateur = require('../models/utilisateur.model');
const models = require('../models');
const Country = require('../models/country.model');
const ShippingRate = require('../models/shippingRate.model');
const MessageClient = require('../models/messageClient.model');
const GestionAdmin = require('../services/admin/gestionadmin.service');
const GestionUtilisateur = require('../services/admin/gestionutilisateur.service');
const Rgpd = require('../services/rgpd.service');
const CountryService = require('../services/country.service');
const messageCtrl = require('../controllers/messageClient.controller');
const gestionAdminCtrl = require('../controllers/admin/gestionadmin.controller');

const UtilisateurReel = jest.requireActual('../models/utilisateur.model');
const sequelize = require('../config/db');

// Aucune base : la transaction RGPD exécute son callback sur une transaction factice.
beforeEach(() => {
  jest.spyOn(sequelize, 'transaction').mockImplementation(async (cb) => cb({ id: 't' }));
});

describe('sérialisation d’un utilisateur', () => {
  it('toJSON ne renvoie jamais hash, jetons, OTP ni jeton push', () => {
    const u = UtilisateurReel.build({
      nom: 'A', prenom: 'B', email: 'a@b.co', adresse: '', mot_de_passe: 'HASH', fcm_token: 'FCM',
      otpCode: '123456', resetPasswordToken: 'RT', passwordChangedAt: new Date(),
    });
    const json = JSON.stringify(u);
    for (const secret of ['HASH', 'FCM', '123456', 'RT', 'passwordChangedAt']) expect(json).not.toContain(secret);
    expect(u.mot_de_passe).toBe('HASH'); // toujours lisible côté serveur
  });
});

describe('gestion des admins — garde-fous', () => {
  const admin = (s = {}) => ({ id: 'a-2', role: 'Admin', statut: 'actif', save: jest.fn(async () => {}), ...s });

  it('se désactiver soi-même : 400', async () => {
    Utilisateur.findByPk.mockResolvedValue(admin({ id: 'moi' }));
    expect(await GestionAdmin.desactiverAdmin('moi', 'moi')).toMatchObject({ success: false, status: 400, message: 'Vous ne pouvez pas désactiver votre propre compte' });
  });

  it('dernier admin actif : 400, rien n’est enregistré', async () => {
    const a = admin();
    Utilisateur.findByPk.mockResolvedValue(a);
    Utilisateur.count.mockResolvedValue(0);
    expect(await GestionAdmin.desactiverAdmin('a-2', 'moi')).toMatchObject({ success: false, status: 400 });
    expect(a.save).not.toHaveBeenCalled();
    expect(Utilisateur.count).toHaveBeenCalledWith({ where: { role: 'Admin', statut: 'actif', id: { [Op.ne]: 'a-2' } } });
  });

  it('un autre admin actif existe : désactivé', async () => {
    const a = admin();
    Utilisateur.findByPk.mockResolvedValue(a);
    Utilisateur.count.mockResolvedValue(1);
    expect((await GestionAdmin.desactiverAdmin('a-2', 'moi')).success).toBe(true);
    expect(a.statut).toBe('inactif');
  });

  it('un CLIENT via les routes admin : 404 « Admin introuvable »', async () => {
    Utilisateur.findByPk.mockResolvedValue(admin({ role: 'Particulier' }));
    expect(await GestionAdmin.desactiverAdmin('c', 'moi')).toMatchObject({ status: 404 });
    expect(await GestionAdmin.activerAdmin('c')).toMatchObject({ status: 404 });
  });

  it('le contrôleur renvoie le code du garde-fou (400) sans fuite du champ status', async () => {
    Utilisateur.findByPk.mockResolvedValue(admin({ id: 'moi' }));
    const res = { status: jest.fn(function s() { return this; }), json: jest.fn() };
    await gestionAdminCtrl.desactiverAdmin({ params: { id: 'moi' }, user: { id: 'moi' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0]).not.toHaveProperty('status');
  });

  it('ajout : e-mail invalide, mot de passe faible, téléphone vide → NULL (colonne unique)', async () => {
    Utilisateur.findOne.mockResolvedValue(null);
    expect((await GestionAdmin.ajouterAdmin('Ali', 'Ba', 'pas-un-email', 'Secret123', '', '')).message).toBe('Adresse e-mail invalide');
    expect((await GestionAdmin.ajouterAdmin('Ali', 'Ba', 'n@x.co', 'faible', '', '')).success).toBe(false);
    Utilisateur.create.mockImplementation(async (v) => v);
    const r = await GestionAdmin.ajouterAdmin('Ali', 'Ba', ' N@X.co ', 'Secret123', '  ', null);
    expect(r.success).toBe(true);
    expect(Utilisateur.create).toHaveBeenCalledWith(expect.objectContaining({ email: 'n@x.co', telephone: null, role: 'Admin', statut: 'actif' }));
    expect(Utilisateur.create.mock.calls[0][0].mot_de_passe).not.toBe('Secret123');
  });

  it('ajout : nom, prénom et téléphone validés comme à l’inscription', async () => {
    Utilisateur.findOne.mockResolvedValue(null);
    Utilisateur.create.mockImplementation(async (v) => v);
    expect((await GestionAdmin.ajouterAdmin('A', 'Ba', 'n@x.co', 'Secret123', '', '')).success).toBe(false);
    expect((await GestionAdmin.ajouterAdmin('Ali', 'Ba', 'n@x.co', 'Secret123', 'abc', '')).message).toBe('Numéro de téléphone invalide');
    expect(Utilisateur.create).not.toHaveBeenCalled();
    const r = await GestionAdmin.ajouterAdmin(' Ali ', 'Ba', 'n@x.co', 'Secret123', '+223 76 00 00 00', '');
    expect(r.success).toBe(true);
    expect(Utilisateur.create).toHaveBeenCalledWith(expect.objectContaining({ nom: 'Ali', telephone: '+223 76 00 00 00' }));
  });

  it('liste : jamais l’admin connecté, champs privés exclus, recherche insensible à la casse', async () => {
    Utilisateur.findAll.mockResolvedValue([]);
    await GestionAdmin.listeAdmins('moi', { q: 'Dupont' });
    const opts = Utilisateur.findAll.mock.calls[0][0];
    expect(opts.where.id).toEqual({ [Op.ne]: 'moi' });
    expect(opts.attributes.exclude).toEqual(expect.arrayContaining(['mot_de_passe', 'fcm_token']));
    expect(opts.where[Op.or][0].nom[Op.iLike]).toBe('%Dupont%');
  });

  it('rechercher-admin : ILIKE échappé (avant : LIKE brut sensible à la casse)', async () => {
    Utilisateur.findAll.mockResolvedValue([]);
    await GestionAdmin.rechercherAdmin({ nom: 'du_pont' });
    expect(Utilisateur.findAll.mock.calls[0][0].where.nom).toEqual({ [Op.iLike]: '%du\\_pont%' });
  });
});

describe('gestion des clients', () => {
  it('liste et compteur : comptes destinataires automatiques EXCLUS', async () => {
    Utilisateur.findAll.mockResolvedValue([]);
    Utilisateur.count.mockResolvedValue(3);
    await GestionUtilisateur.listeUtilisateur({});
    expect(Utilisateur.findAll.mock.calls[0][0].where).toMatchObject({ role: 'Particulier', compteAuto: false });
    await GestionUtilisateur.nombreUtilisateursParticuliers();
    expect(Utilisateur.count).toHaveBeenCalledWith({ where: { role: 'Particulier', compteAuto: false } });
    await GestionUtilisateur.rechercherUtilisateur({ email: 'x' });
    expect(Utilisateur.findAll.mock.calls[1][0].where).toMatchObject({ compteAuto: false, email: { [Op.iLike]: '%x%' } });
  });

  it('activer un compte destinataire automatique : refusé (la personne doit s’inscrire)', async () => {
    const u = { role: 'Particulier', statut: 'inactif', compteAuto: true, save: jest.fn() };
    Utilisateur.findByPk.mockResolvedValue(u);
    await expect(GestionUtilisateur.activerUtilisateur({ id: 'x' })).rejects.toThrow(/doit s'inscrire/);
    expect(u.save).not.toHaveBeenCalled();
  });

  it('(dés)activer un ADMIN par les routes clients : « non trouvé »', async () => {
    Utilisateur.findByPk.mockResolvedValue({ role: 'Admin', statut: 'actif', save: jest.fn() });
    await expect(GestionUtilisateur.desactiverUtilisateur({ id: 'a' })).rejects.toThrow('Utilisateur non trouvé');
    await expect(GestionUtilisateur.activerUtilisateur({ id: 'a' })).rejects.toThrow('Utilisateur non trouvé');
  });

  it('désactiver un client actif : statut inactif, réponse sans champ privé', async () => {
    const u = UtilisateurReel.build({ nom: 'A', prenom: 'B', email: 'a@b.co', adresse: '', mot_de_passe: 'HASH', role: 'Particulier', statut: 'actif' });
    u.save = jest.fn(async () => {});
    Utilisateur.findByPk.mockResolvedValue(u);
    const r = await GestionUtilisateur.desactiverUtilisateur({ id: 'x' });
    expect(r.statut).toBe('inactif');
    expect(r).not.toHaveProperty('mot_de_passe');
  });
});

describe('suppression de compte (RGPD)', () => {
  const client = (s = {}) => ({ id: 'u-1', role: 'Particulier', statut: 'actif', update: jest.fn(async () => {}), destroy: jest.fn(async () => {}), ...s });

  it('anonymisation complète, données propres supprimées, colis CONSERVÉS', async () => {
    const u = client();
    Utilisateur.findByPk.mockResolvedValue(u);
    const r = await Rgpd.deleteUserAccount('u-1');
    expect(r.success).toBe(true);
    const valeurs = u.update.mock.calls[0][0];
    expect(valeurs).toMatchObject({ nom: 'Compte', prenom: 'supprimé', telephone: null, adresse: '', statut: 'inactif', fcm_token: null, photoProfil: null, otpCode: null });
    expect(valeurs.email).toBe('supprime-u-1@compte-supprime.invalid');
    expect(valeurs.mot_de_passe).toMatch(/^\$2[aby]\$/);
    expect(u.destroy).toHaveBeenCalled();
    for (const m of ['Notifications', 'ContactFavori', 'Avis', 'Reclamation', 'RefreshToken']) expect(models[m].destroy).toHaveBeenCalled();
    expect(models).not.toHaveProperty('Colis');
  });

  it('dernier admin actif : refus, rien n’est effacé', async () => {
    const u = client({ role: 'Admin' });
    Utilisateur.findByPk.mockResolvedValue(u);
    Utilisateur.count.mockResolvedValue(0);
    expect(await Rgpd.deleteUserAccount('u-1')).toEqual({ success: false, message: 'Impossible de supprimer le dernier administrateur actif' });
    expect(u.update).not.toHaveBeenCalled();
  });

  it('compte inconnu : refus', async () => {
    Utilisateur.findByPk.mockResolvedValue(null);
    expect((await Rgpd.deleteUserAccount('x')).success).toBe(false);
  });
});

describe('pays', () => {
  it('doublon de code (« fra » vs « FRA ») ou de nom (casse) : refus explicite', async () => {
    Country.findOne.mockResolvedValue({ id: 'c', code: 'FRA', name: 'France' });
    expect((await CountryService.createCountry({ name: 'Autre', code: 'fra' })).message).toBe('Un pays avec ce code existe déjà');
    Country.findOne.mockResolvedValue({ id: 'c', code: 'FRA', name: 'France' });
    expect((await CountryService.createCountry({ name: 'FRANCE', code: 'FRX' })).message).toBe('Un pays avec ce nom existe déjà');
    expect(Country.create).not.toHaveBeenCalled();
  });

  it('création : code en MAJUSCULES, nom nettoyé', async () => {
    Country.findOne.mockResolvedValue(null);
    Country.create.mockImplementation(async (v) => v);
    await CountryService.createCountry({ name: ' Mali ', code: 'mli' });
    expect(Country.create).toHaveBeenCalledWith({ name: 'Mali', code: 'MLI', isActive: true });
  });

  it('mise à jour : le pays lui-même n’est pas un doublon de lui-même', async () => {
    Country.findByPk.mockResolvedValue({ id: 'c', update: jest.fn() });
    Country.findOne.mockResolvedValue(null);
    await CountryService.updateCountry('c', { name: 'Mali' });
    expect(Country.findOne.mock.calls[0][0].where.id).toEqual({ [Op.ne]: 'c' });
  });

  it('suppression d’un pays encore utilisé : 409 avec la raison', async () => {
    const pays = { id: 'c', destroy: jest.fn() };
    Country.findByPk.mockResolvedValue(pays);
    ShippingRate.count.mockResolvedValueOnce(1);
    models.ContactFavori.count.mockResolvedValueOnce(2);
    const r = await CountryService.deleteCountry('c');
    expect(r).toMatchObject({ success: false, status: 409 });
    expect(r.message).toMatch(/tarifs de transport et 2 contact\(s\)/);
    expect(pays.destroy).not.toHaveBeenCalled();
  });

  it('suppression d’un pays libre : OK ; inconnu : 404', async () => {
    const pays = { id: 'c', destroy: jest.fn(async () => {}) };
    Country.findByPk.mockResolvedValue(pays);
    expect((await CountryService.deleteCountry('c')).success).toBe(true);
    Country.findByPk.mockResolvedValue(null);
    expect(await CountryService.deleteCountry('x')).toMatchObject({ status: 404 });
  });
});

describe('POST /nanei/messages (support, public)', () => {
  const app = express();
  app.use(express.json());
  app.post('/messages', messageCtrl.envoyerMessage);

  it.each([
    [{ email: 'a@b.co', objet: 'x' }, /obligatoires/],
    [{ email: 'pas-un-email', objet: 'x', description: 'd' }, /Adresse email invalide/],
    [{ email: 'a@b.co', objet: 'x'.repeat(201), description: 'd' }, /200 caractères/],
  ])('refus 400 : %p', async (corps, message) => {
    const r = await request(app).post('/messages').send(corps);
    expect(r.status).toBe(400);
    expect(r.body.message).toMatch(message);
    expect(MessageClient.create).not.toHaveBeenCalled();
  });

  it('message valide : 201, seul l’identifiant est renvoyé', async () => {
    const r = await request(app).post('/messages').send({ email: ' a@b.co ', objet: ' Colis ', description: 'Bonjour' });
    expect(r.status).toBe(201);
    expect(r.body.data).toEqual({ id: 'm-1' });
    expect(MessageClient.create).toHaveBeenCalledWith({ email: 'a@b.co', objet: 'Colis', description: 'Bonjour' });
  });
});
