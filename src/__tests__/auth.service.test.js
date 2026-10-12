'use strict';

/**
 * Authentification (services/auth.service.js) : connexion, inscription,
 * mot de passe oublié / réinitialisation.
 *
 * ## Les défauts que ce test rend impossibles
 *
 * - ÉNUMÉRATION DE COMPTES : savoir si un e-mail ou un numéro a un compte, ou
 *   lequel est désactivé, par la différence de message ou de durée de la
 *   connexion (un compte inconnu passe aussi par bcrypt), ou par le
 *   « mot de passe oublié » (avant ce correctif : 400 « Action non
 *   autorisée » pour un e-mail d'admin) ou la réinitialisation (avant :
 *   « Compte introuvable » pour un e-mail inconnu).
 * - REVENDICATION DE COMPTE : s'inscrire avec l'e-mail ou le téléphone d'un
 *   client DÉSACTIVÉ par un admin et récupérer son compte. Seuls les comptes
 *   destinataires créés automatiquement (`compteAuto`) sont revendicables.
 * - REFRESH TOKEN stocké en clair, ou deux refresh tokens identiques émis la
 *   même seconde (même empreinte → violation d'unicité → 500 ; corrigé par
 *   un `jti` aléatoire).
 * - Code OTP stocké en clair, essais illimités, sessions conservées après
 *   réinitialisation.
 */

jest.mock('../config/db', () => {
  const t = { commit: jest.fn(async () => {}), rollback: jest.fn(async () => {}) };
  return {
    __t: t,
    transaction: jest.fn(async (cb) => (typeof cb === 'function' ? cb(t) : t)),
    fn: jest.fn((...a) => ({ fn: a })),
    col: jest.fn((c) => ({ col: c })),
    where: jest.fn((a, b) => ({ where: [a, b] })),
  };
});
jest.mock('../models/utilisateur.model', () => ({ findOne: jest.fn(), findAll: jest.fn(), findByPk: jest.fn(), create: jest.fn() }));
jest.mock('../models/refreshToken.model', () => ({ create: jest.fn(async () => ({})), update: jest.fn(async () => [1]) }));
jest.mock('../models/userOtp.model', () => ({ destroy: jest.fn(async () => 1), create: jest.fn(async () => ({})), findOne: jest.fn() }));
jest.mock('../config/security', () => ({ ...jest.requireActual('../config/security'), bcryptConfig: { saltRounds: 4 } }));

const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Utilisateur = require('../models/utilisateur.model');
const RefreshToken = require('../models/refreshToken.model');
const UserOtp = require('../models/userOtp.model');
const { sendOtpEmail } = require('../services/resend.service');
const { jwtConfig } = require('../config/security');
const AuthService = require('../services/auth.service');

const sha256 = (v) => crypto.createHash('sha256').update(v).digest('hex');

let HASH;
beforeAll(async () => { HASH = await bcrypt.hash('Secret123', 4); });

function compte(surcharge = {}) {
  return {
    id: '11111111-1111-4111-8111-111111111111', nom: 'Diallo', prenom: 'Awa', email: 'awa@test.ml',
    telephone: '+22376000000', adresse: 'Bamako', role: 'Particulier', statut: 'actif',
    mot_de_passe: HASH, compteAuto: false, passwordChangedAt: null,
    save: jest.fn(async () => {}),
    ...surcharge,
  };
}

describe('login — sans énumération de comptes', () => {
  it('identifiant inconnu : message générique ET comparaison bcrypt quand même (même durée)', async () => {
    Utilisateur.findOne.mockResolvedValue(null);
    const compare = jest.spyOn(bcrypt, 'compare');
    const r = await AuthService.login({ identifiant: 'inconnu@test.ml', mot_de_passe: 'x' });
    expect(r).toEqual({ success: false, message: 'Identifiant ou mot de passe incorrect' });
    expect(compare).toHaveBeenCalledTimes(1);
  });

  it('mauvais mot de passe : MÊME message que l’identifiant inconnu', async () => {
    Utilisateur.findOne.mockResolvedValue(compte());
    const r = await AuthService.login({ identifiant: 'awa@test.ml', mot_de_passe: 'Mauvais1' });
    expect(r.message).toBe('Identifiant ou mot de passe incorrect');
  });

  it('compte désactivé + MAUVAIS mot de passe : rien ne révèle la désactivation', async () => {
    Utilisateur.findOne.mockResolvedValue(compte({ statut: 'inactif' }));
    const r = await AuthService.login({ identifiant: 'awa@test.ml', mot_de_passe: 'Mauvais1' });
    expect(r.message).toBe('Identifiant ou mot de passe incorrect');
  });

  it('compte désactivé + BON mot de passe : refus explicite, sans jeton', async () => {
    Utilisateur.findOne.mockResolvedValue(compte({ statut: 'inactif' }));
    const r = await AuthService.login({ identifiant: 'awa@test.ml', mot_de_passe: 'Secret123' });
    expect(r).toEqual({ success: false, message: 'Compte désactivé. Contactez le support.' });
    expect(RefreshToken.create).not.toHaveBeenCalled();
  });

  it('succès : e-mail normalisé, jeton d’accès signé, refresh token stocké HACHÉ', async () => {
    Utilisateur.findOne.mockResolvedValue(compte());
    const r = await AuthService.login({ identifiant: '  AWA@Test.ML ', mot_de_passe: 'Secret123' });
    expect(Utilisateur.findOne).toHaveBeenCalledWith({ where: { email: 'awa@test.ml' } });
    expect(r.success).toBe(true);
    expect(jwt.verify(r.token, jwtConfig.secret)).toMatchObject({ id: compte().id, role: 'Particulier' });
    expect(jwt.verify(r.refreshToken, jwtConfig.refreshSecret).id).toBe(compte().id);
    const stocke = RefreshToken.create.mock.calls[0][0];
    expect(stocke.tokenHash).toBe(sha256(r.refreshToken));
    expect(JSON.stringify(stocke)).not.toContain(r.refreshToken);
  });

  it('connexion par téléphone (numéro local) : un seul compte possible → connecté', async () => {
    Utilisateur.findOne.mockResolvedValue(null); // pas de correspondance exacte
    Utilisateur.findAll
      .mockResolvedValueOnce([]) // mêmes chiffres
      .mockResolvedValueOnce([compte()]); // se termine par
    const r = await AuthService.login({ identifiant: '76 00 00 00', mot_de_passe: 'Secret123' });
    expect(r.success).toBe(true);
  });

  it('téléphone ambigu (2 comptes actifs) : on refuse plutôt que de connecter la mauvaise personne', async () => {
    Utilisateur.findOne.mockResolvedValue(null);
    Utilisateur.findAll.mockResolvedValueOnce([]).mockResolvedValueOnce([compte(), compte({ id: 'autre' })]);
    expect(await AuthService.trouverParTelephone('76000000')).toBeNull();
  });

  it('deux refresh tokens émis la même seconde sont DIFFÉRENTS (jti)', async () => {
    const a = await AuthService.genererRefreshToken(compte());
    const b = await AuthService.genererRefreshToken(compte());
    expect(a).not.toBe(b);
    expect(RefreshToken.create.mock.calls[0][0].tokenHash).not.toBe(RefreshToken.create.mock.calls[1][0].tokenHash);
  });
});

describe('register — revendication des comptes destinataires automatiques UNIQUEMENT', () => {
  const DONNEES = { nom: 'Keita', prenom: 'Moussa', email: 'Moussa@Test.ML', mot_de_passe: 'Secret123', telephone: '+22370000000' };

  it('la recherche d’un compte à revendiquer exige compteAuto = true, inactif, Particulier', async () => {
    Utilisateur.findOne.mockResolvedValue(null);
    Utilisateur.create.mockImplementation(async (v) => ({ id: 'neuf', ...v }));
    await AuthService.register(DONNEES);
    const where = Utilisateur.findOne.mock.calls[0][0].where;
    expect(where).toMatchObject({ statut: 'inactif', role: 'Particulier', compteAuto: true });
  });

  it('compte destinataire automatique trouvé : complété, ACTIVÉ, compteAuto retiré, mot de passe haché', async () => {
    const fantome = compte({ id: 'fantome', statut: 'inactif', compteAuto: true, email: 'no-email-x@nanei.local', mot_de_passe: 'aleatoire' });
    Utilisateur.findOne.mockResolvedValueOnce(fantome).mockResolvedValueOnce(null); // pas de collision
    const r = await AuthService.register(DONNEES);
    expect(r.success).toBe(true);
    expect(r.utilisateur).toBe(fantome);
    expect(fantome).toMatchObject({ statut: 'actif', compteAuto: false, email: 'moussa@test.ml', nom: 'Keita' });
    expect(await bcrypt.compare('Secret123', fantome.mot_de_passe)).toBe(true);
    expect(fantome.save).toHaveBeenCalled();
    expect(Utilisateur.create).not.toHaveBeenCalled();
  });

  it('client désactivé par un admin (compteAuto = false) : NON revendiqué → « déjà utilisé »', async () => {
    // La recherche de compte revendicable (compteAuto: true) ne le trouve
    // pas ; le contrôle d'unicité, lui, le trouve.
    Utilisateur.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(compte({ statut: 'inactif', email: 'moussa@test.ml' }));
    const r = await AuthService.register(DONNEES);
    expect(r).toEqual({ success: false, message: 'Cet email est déjà utilisé' });
    expect(Utilisateur.create).not.toHaveBeenCalled();
  });

  it('revendication impossible si un AUTRE compte a déjà ce téléphone', async () => {
    Utilisateur.findOne
      .mockResolvedValueOnce(compte({ id: 'fantome', statut: 'inactif', compteAuto: true }))
      .mockResolvedValueOnce(compte({ id: 'autre', email: 'autre@test.ml' }));
    const r = await AuthService.register(DONNEES);
    expect(r).toEqual({ success: false, message: 'Ce numéro de téléphone est déjà utilisé' });
  });

  it('nouveau compte : rôle Particulier, statut par défaut, e-mail normalisé, adresse vide si absente', async () => {
    Utilisateur.findOne.mockResolvedValue(null);
    Utilisateur.create.mockImplementation(async (v) => ({ id: 'neuf', ...v }));
    const r = await AuthService.register(DONNEES);
    expect(r.success).toBe(true);
    const cree = Utilisateur.create.mock.calls[0][0];
    expect(cree).toMatchObject({ email: 'moussa@test.ml', role: 'Particulier', adresse: '' });
    expect(cree.mot_de_passe).not.toBe('Secret123');
    expect(cree).not.toHaveProperty('statut');
  });

  it('téléphone ou mot de passe manquant : refus', async () => {
    expect((await AuthService.register({ ...DONNEES, telephone: '' })).message).toMatch(/téléphone est obligatoire/);
    expect((await AuthService.register({ ...DONNEES, mot_de_passe: '' })).message).toMatch(/mot de passe est obligatoire/);
  });
});

describe('oublierPassword — réponse identique quel que soit le compte', () => {
  const GENERIQUE = 'Si un compte existe avec cet email, un code de réinitialisation a été envoyé.';

  it.each([
    ['inconnu', null],
    ['administrateur', compte({ role: 'Admin' })],
    ['désactivé', compte({ statut: 'inactif' })],
  ])('compte %s : succès générique, aucun e-mail, aucun code', async (_l, trouve) => {
    Utilisateur.findOne.mockResolvedValue(trouve);
    expect(await AuthService.oublierPassword('x@test.ml')).toEqual({ success: true, message: GENERIQUE });
    expect(sendOtpEmail).not.toHaveBeenCalled();
    expect(UserOtp.create).not.toHaveBeenCalled();
  });

  it('client actif : code à 6 chiffres envoyé, seul son HACHÉ est stocké (10 min)', async () => {
    Utilisateur.findOne.mockResolvedValue(compte());
    const r = await AuthService.oublierPassword('Awa@Test.ml');
    expect(r).toEqual({ success: true, message: GENERIQUE });
    const { otp } = sendOtpEmail.mock.calls[0][0];
    expect(otp).toMatch(/^\d{6}$/);
    const stocke = UserOtp.create.mock.calls[0][0];
    expect(stocke.otpHash).not.toBe(otp);
    expect(await bcrypt.compare(otp, stocke.otpHash)).toBe(true);
    expect(stocke.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(10 * 60 * 1000);
    expect(UserOtp.destroy).toHaveBeenCalled(); // l'ancien code est invalidé
  });

  it('panne du fournisseur d’e-mail : message générique, jamais l’erreur brute', async () => {
    Utilisateur.findOne.mockResolvedValue(compte());
    sendOtpEmail.mockRejectedValueOnce(new Error('API key is invalid'));
    await expect(AuthService.oublierPassword('awa@test.ml')).rejects.toThrow(/Impossible d'envoyer l'email/);
  });
});

describe('resetPassword', () => {
  const AUCUN = 'Aucun code de réinitialisation trouvé. Veuillez refaire la demande.';
  let otpHash;
  beforeAll(async () => { otpHash = await bcrypt.hash('123456', 4); });

  const enregistrement = (surcharge = {}) => ({
    otpHash, expiresAt: new Date(Date.now() + 60000), failedAttempts: 0, lockedUntil: null,
    destroy: jest.fn(async () => {}), increment: jest.fn(async () => {}), update: jest.fn(async () => {}),
    ...surcharge,
  });

  it('e-mail inconnu : MÊME réponse qu’un compte sans code (pas d’énumération)', async () => {
    Utilisateur.findOne.mockResolvedValueOnce(null);
    const inconnu = await AuthService.resetPassword('x@test.ml', '123456', 'Nouveau123');
    Utilisateur.findOne.mockResolvedValueOnce(compte());
    UserOtp.findOne.mockResolvedValueOnce(null);
    const sansCode = await AuthService.resetPassword('awa@test.ml', '123456', 'Nouveau123');
    expect(inconnu).toEqual({ success: false, message: AUCUN });
    expect(sansCode).toEqual(inconnu);
  });

  it('code expiré : supprimé', async () => {
    const otp = enregistrement({ expiresAt: new Date(Date.now() - 1000) });
    Utilisateur.findOne.mockResolvedValue(compte());
    UserOtp.findOne.mockResolvedValue(otp);
    expect((await AuthService.resetPassword('awa@test.ml', '123456', 'Nouveau123')).message).toMatch(/expiré/);
    expect(otp.destroy).toHaveBeenCalled();
  });

  it('mauvais code : essai compté ; au 3e, blocage 15 min', async () => {
    Utilisateur.findOne.mockResolvedValue(compte());
    const otp = enregistrement({ failedAttempts: 0 });
    UserOtp.findOne.mockResolvedValue(otp);
    expect((await AuthService.resetPassword('awa@test.ml', '000000', 'Nouveau123')).message).toMatch(/2 tentatives restantes/);
    expect(otp.increment).toHaveBeenCalledWith('failedAttempts');

    const troisieme = enregistrement({ failedAttempts: 2 });
    UserOtp.findOne.mockResolvedValue(troisieme);
    expect((await AuthService.resetPassword('awa@test.ml', '000000', 'Nouveau123')).message).toMatch(/15 minutes/);
    expect(troisieme.update).toHaveBeenCalledWith({ lockedUntil: expect.any(Date) });
  });

  it('compte bloqué : refus même avec le bon code', async () => {
    Utilisateur.findOne.mockResolvedValue(compte());
    UserOtp.findOne.mockResolvedValue(enregistrement({ lockedUntil: new Date(Date.now() + 5 * 60000) }));
    expect((await AuthService.resetPassword('awa@test.ml', '123456', 'Nouveau123')).message).toMatch(/Trop de tentatives/);
  });

  it('bon code : mot de passe haché, TOUTES les sessions révoquées, code consommé', async () => {
    const u = compte();
    const otp = enregistrement();
    Utilisateur.findOne.mockResolvedValue(u);
    UserOtp.findOne.mockResolvedValue(otp);
    const r = await AuthService.resetPassword('awa@test.ml', '123456', 'Nouveau123');
    expect(r).toEqual({ success: true, message: 'Mot de passe réinitialisé avec succès' });
    expect(await bcrypt.compare('Nouveau123', u.mot_de_passe)).toBe(true);
    expect(u.passwordChangedAt).toBeInstanceOf(Date);
    expect(RefreshToken.update).toHaveBeenCalledWith({ revoked: true }, expect.objectContaining({ where: { utilisateurId: u.id, revoked: false } }));
    expect(u.save).toHaveBeenCalled();
    expect(otp.destroy).toHaveBeenCalled();
  });
});
