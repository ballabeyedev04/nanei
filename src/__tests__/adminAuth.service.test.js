'use strict';

/**
 * Mot de passe oublié de l'ADMIN (services/adminAuth.service.js,
 * POST /nanei/admin/forgot-password et /reset-password).
 *
 * ## Les défauts que ce test rend impossibles
 *
 * - Trouvé en écrivant ce test : `logger` n'était pas importé. En
 *   production sans FRONTEND_URL (ni origine HTTPS dans CORS_ORIGIN), la
 *   demande levait une ReferenceError → 500, au lieu de la réponse neutre.
 * - Savoir si une adresse est celle d'un admin actif (réponse ou durée
 *   différentes).
 * - Un lien de réinitialisation envoyé vers localhost en production.
 * - Un jeton de réinitialisation réutilisable, valable pour un client, pour
 *   un compte désactivé, ou qui ne coupe pas les sessions existantes.
 */

jest.mock('../models/utilisateur.model', () => ({ findOne: jest.fn(), findByPk: jest.fn() }));
jest.mock('../models/refreshToken.model', () => ({ update: jest.fn(async () => [1]), create: jest.fn() }));
jest.mock('../config/db', () => ({ transaction: jest.fn(), fn: jest.fn(), col: jest.fn(), where: jest.fn() }));
jest.mock('../config/security', () => ({ ...jest.requireActual('../config/security'), bcryptConfig: { saltRounds: 4 } }));

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const Utilisateur = require('../models/utilisateur.model');
const RefreshToken = require('../models/refreshToken.model');
const { sendEmail } = require('../services/resend.service');
const { jwtConfig } = require('../config/security');
const AdminAuthService = require('../services/adminAuth.service');

const GENERIQUE = 'Si cet email correspond à un compte administrateur actif, un lien de réinitialisation vous a été envoyé.';
const admin = (s = {}) => ({
  id: 'a-1', nom: 'Admin', prenom: 'Nanei', email: 'admin@nanei.test', role: 'Admin', statut: 'actif',
  resetPasswordToken: null, resetPasswordExpires: null, save: jest.fn(async () => {}), ...s,
});

const ENV = { ...process.env };
afterEach(() => {
  for (const k of ['NODE_ENV', 'FRONTEND_URL', 'CORS_ORIGIN']) process.env[k] = ENV[k];
});

describe('forgotPassword', () => {
  it.each([
    ['inconnu', null],
    ['client', admin({ role: 'Particulier' })],
    ['admin désactivé', admin({ statut: 'inactif' })],
  ])('compte %s : réponse générique, aucun e-mail, temps minimal respecté', async (_l, trouve) => {
    Utilisateur.findOne.mockResolvedValue(trouve);
    const debut = Date.now();
    expect(await AdminAuthService.forgotPassword('X@nanei.test')).toEqual({ success: true, message: GENERIQUE });
    expect(Date.now() - debut).toBeGreaterThanOrEqual(380);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('admin actif : seule l’EMPREINTE du jeton est stockée, lien vers FRONTEND_URL', async () => {
    process.env.FRONTEND_URL = 'https://admin.nanei.test/';
    const a = admin();
    Utilisateur.findOne.mockResolvedValue(a);
    expect(await AdminAuthService.forgotPassword('admin@nanei.test')).toEqual({ success: true, message: GENERIQUE });
    const { html, to } = sendEmail.mock.calls[0][0];
    expect(to).toBe('admin@nanei.test');
    const lien = /https:\/\/admin\.nanei\.test\/nanei\/admin\/reset-password\?token=([\w.-]+)/.exec(html);
    expect(lien).not.toBeNull();
    const { rawToken, purpose } = jwt.verify(lien[1], jwtConfig.resetSecret);
    expect(purpose).toBe('admin-password-reset');
    expect(a.resetPasswordToken).toBe(crypto.createHash('sha256').update(rawToken).digest('hex'));
    expect(a.resetPasswordToken).not.toBe(rawToken);
  });

  it('production sans FRONTEND_URL ni origine HTTPS : réponse neutre, AUCUN lien localhost, pas de 500', async () => {
    process.env.NODE_ENV = 'production';
    process.env.FRONTEND_URL = '';
    process.env.CORS_ORIGIN = 'http://localhost:5173';
    Utilisateur.findOne.mockResolvedValue(admin());
    await expect(AdminAuthService.forgotPassword('admin@nanei.test')).resolves.toEqual({ success: true, message: GENERIQUE });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('production : à défaut de FRONTEND_URL, première origine HTTPS de CORS_ORIGIN', async () => {
    process.env.NODE_ENV = 'production';
    process.env.FRONTEND_URL = '';
    process.env.CORS_ORIGIN = 'http://localhost:3000, https://back.nanei.app';
    Utilisateur.findOne.mockResolvedValue(admin());
    await AdminAuthService.forgotPassword('admin@nanei.test');
    expect(sendEmail.mock.calls[0][0].html).toContain('https://back.nanei.app/nanei/admin/reset-password?token=');
  });
});

describe('resetPassword', () => {
  function jetonValide(a, surcharge = {}) {
    const rawToken = crypto.randomBytes(32).toString('hex');
    a.resetPasswordToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    a.resetPasswordExpires = new Date(Date.now() + 600000);
    return jwt.sign({ id: a.id, purpose: 'admin-password-reset', rawToken, ...surcharge }, jwtConfig.resetSecret, { expiresIn: '10m' });
  }

  it('jeton signé avec un autre secret, ou d’un autre usage : refus', async () => {
    expect((await AdminAuthService.resetPassword(jwt.sign({ id: 'a-1' }, 'autre'), 'Nouveau1!')).success).toBe(false);
    const a = admin();
    Utilisateur.findByPk.mockResolvedValue(a);
    expect((await AdminAuthService.resetPassword(jetonValide(a, { purpose: 'autre' }), 'Nouveau1!')).message).toMatch(/non autorisé/);
  });

  it.each([
    ['client', { role: 'Particulier' }],
    ['admin désactivé', { statut: 'inactif' }],
  ])('compte %s : refus', async (_l, s) => {
    const a = admin(s);
    Utilisateur.findByPk.mockResolvedValue(a);
    expect((await AdminAuthService.resetPassword(jetonValide(a), 'Nouveau1!')).success).toBe(false);
  });

  it('jeton déjà utilisé (empreinte effacée) : refus — usage unique', async () => {
    const a = admin();
    const jeton = jetonValide(a);
    a.resetPasswordToken = null;
    Utilisateur.findByPk.mockResolvedValue(a);
    expect((await AdminAuthService.resetPassword(jeton, 'Nouveau1!')).message).toMatch(/invalide ou expiré/);
  });

  it('politique admin : caractère spécial exigé', async () => {
    const a = admin();
    Utilisateur.findByPk.mockResolvedValue(a);
    expect((await AdminAuthService.resetPassword(jetonValide(a), 'Nouveau123')).message).toMatch(/caractère spécial/);
  });

  it('succès : mot de passe haché, jeton consommé, sessions révoquées', async () => {
    const a = admin();
    Utilisateur.findByPk.mockResolvedValue(a);
    const r = await AdminAuthService.resetPassword(jetonValide(a), 'Nouveau1!');
    expect(r.success).toBe(true);
    expect(await bcrypt.compare('Nouveau1!', a.mot_de_passe)).toBe(true);
    expect(a.resetPasswordToken).toBeNull();
    expect(a.passwordChangedAt).toBeInstanceOf(Date);
    expect(RefreshToken.update).toHaveBeenCalledWith({ revoked: true }, expect.objectContaining({ where: { utilisateurId: 'a-1', revoked: false } }));
  });
});
