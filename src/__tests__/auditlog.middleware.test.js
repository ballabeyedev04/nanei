'use strict';

/**
 * Journal d'audit des actions admin (middlewares/auditlog.middleware.js).
 *
 * ## Les défauts que ce test rend impossibles
 *
 * - Un mot de passe, un jeton ou un code OTP enregistré EN CLAIR dans le
 *   journal (lisible par tous les admins) — ex. le corps de
 *   POST /admin/ajouter-admin contient `mot_de_passe`.
 * - Une action refusée (4xx / 5xx) journalisée comme si elle avait eu lieu.
 * - Une écriture du journal qui ferait échouer la requête de l'admin.
 */

jest.mock('../models/auditlog.model', () => ({ create: jest.fn(async () => ({})) }));

const EventEmitter = require('events');
const AuditLog = require('../models/auditlog.model');
const auditLog = require('../middlewares/auditlog.middleware');

const { masquerChampsSensibles } = auditLog;

function executer({ statusCode = 200, method = 'POST', body = {}, query = {}, params = {} } = {}) {
  const req = { method, body, query, params, originalUrl: '/nanei/admin/x', ip: '10.0.0.1, 10.0.0.2', headers: {}, user: { id: 'admin-1' } };
  const res = new EventEmitter();
  res.statusCode = statusCode;
  const next = jest.fn();
  auditLog('CREATE', 'Admin')(req, res, next);
  res.emit('finish');
  return { next };
}

const attendre = () => new Promise((r) => setImmediate(r));

describe('masquerChampsSensibles', () => {
  it('masque mots de passe, jetons, OTP, secrets — à toute profondeur et dans les tableaux', () => {
    const entree = {
      email: 'a@b.c',
      mot_de_passe: 'Secret123',
      newPassword: 'x', oldPassword: 'y',
      refreshToken: 'r', token: 't', fcm_token: 'f',
      otp: '123456', code_verif: '1',
      client_secret: 's', pin: '0000',
      profil: { password: 'p', nom: 'Diallo' },
      liste: [{ token: 'z', ok: 1 }],
    };
    const sortie = masquerChampsSensibles(entree);
    expect(sortie).toEqual({
      email: 'a@b.c',
      mot_de_passe: '***',
      newPassword: '***', oldPassword: '***',
      refreshToken: '***', token: '***', fcm_token: '***',
      otp: '***', code_verif: '***',
      client_secret: '***', pin: '***',
      profil: { password: '***', nom: 'Diallo' },
      liste: [{ token: '***', ok: 1 }],
    });
    expect(entree.mot_de_passe).toBe('Secret123'); // l'original n'est pas modifié
  });

  it('valeurs non objets inchangées', () => {
    expect(masquerChampsSensibles(null)).toBeNull();
    expect(masquerChampsSensibles('texte')).toBe('texte');
  });
});

describe('auditLog()', () => {
  it('succès : enregistre l’action, l’auteur, l’entité, l’IP (1re) et le corps MASQUÉ', async () => {
    const { next } = executer({ body: { email: 'n@x.y', mot_de_passe: 'Secret123' }, params: { id: 'u-9' } });
    expect(next).toHaveBeenCalled();
    await attendre();
    expect(AuditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      admin_id: 'admin-1', action: 'CREATE', entite: 'Admin', entite_id: 'u-9', ip_address: '10.0.0.1',
      details: expect.objectContaining({ body: { email: 'n@x.y', mot_de_passe: '***' } }),
    }));
    expect(JSON.stringify(AuditLog.create.mock.calls[0][0])).not.toContain('Secret123');
  });

  it('GET : la requête (filtres d’export) est journalisée, masquée', async () => {
    executer({ method: 'GET', query: { statut: 'livre', token: 'abc' } });
    await attendre();
    expect(AuditLog.create.mock.calls[0][0].details).toEqual(expect.objectContaining({ query: { statut: 'livre', token: '***' }, body: undefined }));
  });

  it.each([400, 403, 404, 409, 500])('réponse %i : rien n’est journalisé', async (code) => {
    executer({ statusCode: code });
    await attendre();
    expect(AuditLog.create).not.toHaveBeenCalled();
  });

  it('une panne du journal ne casse pas la requête', async () => {
    AuditLog.create.mockRejectedValueOnce(new Error('base indisponible'));
    const { next } = executer();
    expect(next).toHaveBeenCalled();
    await attendre();
  });
});
