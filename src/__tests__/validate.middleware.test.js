'use strict';

/**
 * Validation Joi des corps de requête (middlewares/validate.middleware.js et
 * validations/*.js).
 *
 * ## Les défauts que ce test rend impossibles
 *
 * - S'inscrire avec le rôle « Admin » en l'écrivant dans le corps de
 *   POST /auth/register (élévation de privilège à la création).
 * - Un champ inconnu (`statut`, `compteAuto`, `role`…) qui traverse la
 *   validation jusqu'au service.
 * - Un mot de passe faible accepté à l'inscription ou au changement.
 * - Un e-mail en majuscules enregistré tel quel (deux comptes pour la même
 *   adresse, connexion impossible ensuite).
 * - Le code OTP de réinitialisation accepté sous une autre forme que 6
 *   chiffres (le mobile envoie `code`).
 */

const validate = require('../middlewares/validate.middleware');
const { registerSchema, loginSchema, refreshSchema, logoutSchema, resetPasswordSchema } = require('../validations/auth.validation');
const { changePasswordSchema, modifierProfilSchema } = require('../validations/account.validation');

function executer(schema, body, source = 'body') {
  const req = { [source]: body };
  const res = { status: jest.fn(function s() { return this; }), json: jest.fn() };
  const next = jest.fn();
  validate(schema, source)(req, res, next);
  return { req, res, next };
}

const INSCRIPTION = {
  nom: 'Diallo', prenom: 'Aminata', email: 'Aminata.Diallo@Gmail.com',
  mot_de_passe: 'Secret123', telephone: '+223 76 00 00 00',
};

describe('validate()', () => {
  it('corps valide : next(), valeurs converties et champs inconnus retirés', () => {
    const { req, next, res } = executer(registerSchema, { ...INSCRIPTION, statut: 'actif', compteAuto: true });
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(req.body.email).toBe('aminata.diallo@gmail.com');
    expect(req.body.role).toBe('Particulier');
    expect(req.body).not.toHaveProperty('statut');
    expect(req.body).not.toHaveProperty('compteAuto');
  });

  it('corps invalide : 400 « Données invalides » avec TOUS les détails', () => {
    const { res, next } = executer(registerSchema, { nom: 'D', email: 'pas-un-email' });
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    const corps = res.json.mock.calls[0][0];
    expect(corps.message).toBe('Données invalides');
    expect(corps.details.length).toBeGreaterThanOrEqual(3);
  });

  it('peut valider une autre source (query)', () => {
    const { req, next } = executer(loginSchema, { identifiant: ' a@b.c ', mot_de_passe: 'x' }, 'query');
    expect(next).toHaveBeenCalled();
    expect(req.query.identifiant).toBe('a@b.c');
  });
});

describe('schémas', () => {
  it('inscription : le rôle Admin est refusé', () => {
    expect(executer(registerSchema, { ...INSCRIPTION, role: 'Admin' }).res.status).toHaveBeenCalledWith(400);
  });

  it.each(['court1A', 'toutminuscule1', 'TOUTMAJUSCULE1', 'SansChiffre'])('mot de passe faible refusé : %s', (mdp) => {
    expect(executer(registerSchema, { ...INSCRIPTION, mot_de_passe: mdp }).res.status).toHaveBeenCalledWith(400);
    expect(executer(changePasswordSchema, { oldPassword: 'x', newPassword: mdp }).res.status).toHaveBeenCalledWith(400);
  });

  it('téléphone et adresse facultatifs à l’inscription (chaîne vide acceptée)', () => {
    expect(executer(registerSchema, { ...INSCRIPTION, telephone: '', adresse: '' }).next).toHaveBeenCalled();
  });

  it('téléphone mal formé refusé', () => {
    expect(executer(registerSchema, { ...INSCRIPTION, telephone: '<script>' }).res.status).toHaveBeenCalledWith(400);
  });

  it('refresh : refreshToken obligatoire ; logout : facultatif', () => {
    expect(executer(refreshSchema, {}).res.status).toHaveBeenCalledWith(400);
    expect(executer(logoutSchema, {}).next).toHaveBeenCalled();
    expect(executer(logoutSchema, { refreshToken: '' }).next).toHaveBeenCalled();
  });

  it('reset-password : code à 6 chiffres exactement (champ `code` envoyé par le mobile)', () => {
    const base = { email: 'a@b.co', mot_de_passe: 'Nouveau123' };
    expect(executer(resetPasswordSchema, { ...base, code: '123456' }).next).toHaveBeenCalled();
    expect(executer(resetPasswordSchema, { ...base, code: '12345' }).res.status).toHaveBeenCalledWith(400);
    expect(executer(resetPasswordSchema, { ...base, code: '12345a' }).res.status).toHaveBeenCalledWith(400);
    expect(executer(resetPasswordSchema, { ...base, otpRecu: '123456' }).res.status).toHaveBeenCalledWith(400);
  });

  it('modifier-profil : aucun champ sensible ne traverse (role, statut, mot_de_passe)', () => {
    const { req, next } = executer(modifierProfilSchema, { nom: 'Traoré', role: 'Admin', statut: 'actif', mot_de_passe: 'x' });
    expect(next).toHaveBeenCalled();
    expect(req.body).toEqual({ nom: 'Traoré' });
  });
});
