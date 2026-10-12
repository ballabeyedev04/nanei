'use strict';

/**
 * Changement de statut d'un colis par l'admin et listes admin
 * (services/admin/gestioncolis.service.js, routes /nanei/admin/changer-statut-*).
 *
 * ## Les défauts que ce test rend impossibles
 *
 * - Un colis LIVRÉ qui repasse « en attente » (et renvoie push, SMS, e-mails).
 * - Un double clic qui renvoie deux fois les notifications (même statut → 409).
 * - Une réponse admin qui attend Twilio / Resend / Firebase : un fournisseur
 *   lent faisait dépasser le délai de l'admin, qui affichait « Erreur » alors
 *   que le statut avait changé.
 * - Un e-mail envoyé à une adresse technique (`…@nanei.local`, compte
 *   supprimé) ou contenant le HTML d'une référence.
 * - L'historique de suivi public sans trace du changement.
 */

jest.mock('../models', () => ({
  Colis: { findByPk: jest.fn(), findAll: jest.fn(), findAndCountAll: jest.fn(), count: jest.fn(), findOne: jest.fn() },
  Utilisateur: { findByPk: jest.fn() },
  ColisHistorique: { create: jest.fn(async () => ({})) },
}));

const { Colis, Utilisateur, ColisHistorique } = require('../models');
const { sendEmail } = require('../services/resend.service');
const { sendSMS } = require('../services/sms.service');
const { envoyerPushNotification } = require('../services/notification.service');
const Service = require('../services/admin/gestioncolis.service');
const controleur = require('../controllers/admin/gestoncolis.controller');

const attendre = () => new Promise((r) => setImmediate(r));

function colis(statut) {
  return { id: 'c-1', reference: 'COL-2026-ABC', expediteurId: 'e', recepteurId: 'r', statut, save: jest.fn(async () => {}) };
}

describe('transitions de statut', () => {
  it.each([
    ['en_attente', 'recupere', 'changerEnRecupere'],
    ['en_attente', 'livre', 'changerEnLivre'],
    ['recupere', 'livre', 'changerEnLivre'],
    ['recupere', 'en_attente', 'changerEnAttente'],
  ])('%s → %s : autorisé, historisé', async (de, vers, methode) => {
    const c = colis(de);
    Colis.findByPk.mockResolvedValue(c);
    const r = await Service[methode]('c-1', 'admin-1');
    expect(r.success).toBe(true);
    expect(c.statut).toBe(vers);
    expect(c.save).toHaveBeenCalled();
    expect(ColisHistorique.create).toHaveBeenCalledWith({ colis_id: 'c-1', ancien_statut: de, nouveau_statut: vers, admin_id: 'admin-1' });
  });

  it.each([
    ['livre', 'changerEnAttente', /livré ne peut plus/],
    ['livre', 'changerEnRecupere', /livré ne peut plus/],
    ['livre', 'changerEnLivre', /déjà/],
    ['en_attente', 'changerEnAttente', /déjà/],
  ])('%s via %s : 409, rien n’est enregistré ni notifié', async (de, methode, message) => {
    const c = colis(de);
    Colis.findByPk.mockResolvedValue(c);
    const r = await Service[methode]('c-1', 'admin-1');
    expect(r).toMatchObject({ success: false, status: 409 });
    expect(r.message).toMatch(message);
    expect(c.save).not.toHaveBeenCalled();
    await attendre();
    expect(ColisHistorique.create).not.toHaveBeenCalled();
    expect(sendSMS).not.toHaveBeenCalled();
  });

  it('colis inconnu : 404', async () => {
    Colis.findByPk.mockResolvedValue(null);
    expect(await Service.changerEnLivre('x', 'a')).toMatchObject({ success: false, status: 404 });
  });

  it('le contrôleur renvoie le code du service (409) et non 404 ou 500', async () => {
    Colis.findByPk.mockResolvedValue(colis('livre'));
    const res = { status: jest.fn(function s() { return this; }), json: jest.fn() };
    await controleur.changerEnAttente({ params: { id: 'c-1' }, user: { id: 'a' } }, res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0]).not.toHaveProperty('status');
  });
});

describe('notifications du changement de statut', () => {
  const exp = { id: 'e', email: 'exp@test.ml', telephone: '+33600000000', fcm_token: 'fcm-e' };
  const dest = { id: 'r', email: 'no-email-1@nanei.local', telephone: '+22370000000', fcm_token: null };

  it('la réponse n’attend PAS les fournisseurs (push, SMS, e-mail en arrière-plan)', async () => {
    Colis.findByPk.mockResolvedValue(colis('en_attente'));
    let liberer;
    Utilisateur.findByPk.mockImplementation(() => new Promise((r) => { liberer = r; }));
    const r = await Service.changerEnRecupere('c-1', 'a');
    expect(r.success).toBe(true); // résolu alors que la lecture des destinataires est encore en cours
    liberer(null);
  });

  it('push + SMS aux deux parties ; e-mail JAMAIS vers une adresse technique', async () => {
    Colis.findByPk.mockResolvedValue(colis('en_attente'));
    Utilisateur.findByPk.mockImplementation(async (id) => (id === 'e' ? exp : dest));
    await Service.changerEnLivre('c-1', 'a');
    await attendre(); await attendre(); await attendre();
    expect(envoyerPushNotification).toHaveBeenCalledWith('fcm-e', 'Mise à jour colis', expect.stringContaining('Livré'), expect.objectContaining({ statut: 'livre' }));
    expect(sendSMS).toHaveBeenCalledTimes(2);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0][0].to).toBe('exp@test.ml');
  });

  it('une panne SMS / e-mail ne fait pas échouer le changement', async () => {
    Colis.findByPk.mockResolvedValue(colis('en_attente'));
    Utilisateur.findByPk.mockResolvedValue(exp);
    sendSMS.mockRejectedValueOnce(new Error('Twilio down'));
    sendEmail.mockRejectedValueOnce(new Error('Resend down'));
    expect((await Service.changerEnLivre('c-1', 'a')).success).toBe(true);
    await attendre(); await attendre();
  });
});

describe('listes admin', () => {
  it('filtre de statut + recherche q (référence / destination) + taille réelle des lots', async () => {
    const ligne = (id, lot) => ({ toJSON: () => ({ id, lot_id: lot }), lot_id: lot });
    Colis.findAndCountAll.mockResolvedValue({ count: 2, rows: [ligne('a', 'L1'), ligne('b', null)] });
    Colis.findAll.mockResolvedValue([{ lot_id: 'L1', nombre: '4' }]);
    const r = await Service.listeColisLivres({ q: 'COL_2026', page: '1', limit: '2' });
    const { where } = Colis.findAndCountAll.mock.calls[0][0];
    expect(where.statut).toBe('livre');
    const { Op } = require('sequelize');
    expect(where[Op.or][0].reference[Op.iLike]).toBe('%COL\\_2026%'); // « _ » pris littéralement
    expect(r.colis).toEqual([{ id: 'a', lot_id: 'L1', taille_lot: 4 }, { id: 'b', lot_id: null }]);
    expect(r.pagination).toEqual({ page: 1, limit: 2, total: 2, pages: 1 });
  });

  it('sans pagination : réponse historique (pas de clé pagination)', async () => {
    Colis.findAll.mockResolvedValue([]);
    const r = await Service.listeTousLesColis({});
    expect(r).toEqual({ success: true, message: 'Colis récupérés avec succès', colis: [] });
  });
});
