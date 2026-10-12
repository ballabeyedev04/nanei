'use strict';

/**
 * Envoi de colis et listes du client (services/client/envoieColis.service.js).
 *
 * ## Les défauts que ce test rend impossibles
 *
 * - PRIX FALSIFIÉ : le prix d'un colis venait du corps de la requête. Il est
 *   désormais recalculé côté serveur (même grille que /pricing/calculate) dès
 *   que le mobile envoie countryId + shippingType ; le `prix` du client est
 *   alors ignoré (et refusé si PRIX_SERVEUR_OBLIGATOIRE=true).
 * - `type_transport` non enregistré ou enregistré avec accent (« aérien ») :
 *   les étiquettes, le ZPL et le suivi public attendent 'aerien' | 'maritime'.
 * - ANNUAIRE OUVERT : « rechercher-client » renvoyait jusqu'à 20 comptes
 *   (e-mail et téléphone complets) pour une saisie partielle. Désormais :
 *   e-mail ou téléphone EXACT, un seul compte, client actif, données masquées.
 * - Un compte administrateur choisi comme destinataire.
 * - Un lot à moitié créé (transaction unique, tout ou rien) ou de plus de 20.
 * - Listes : filtre `statut` inconnu → 500 ; compteurs `par_statut` faux car
 *   calculés sur la seule page affichée ; badge `non_lues` limité à la page.
 */

jest.mock('../config/db', () => {
  const t = { commit: jest.fn(async () => {}), rollback: jest.fn(async () => {}) };
  return { __t: t, transaction: jest.fn(async () => t), fn: jest.fn(), col: jest.fn(), where: jest.fn() };
});
jest.mock('../models', () => ({
  Colis: { create: jest.fn(), findOne: jest.fn(), findAll: jest.fn(), findAndCountAll: jest.fn(), count: jest.fn() },
  // Même objet que models/utilisateur.model (comme dans le vrai code).
  Utilisateur: jest.requireMock('../models/utilisateur.model'),
  Notifications: { create: jest.fn(async () => ({})), findAll: jest.fn(), findAndCountAll: jest.fn(), count: jest.fn(), findOne: jest.fn(), update: jest.fn() },
  ContactFavori: { findOne: jest.fn(), create: jest.fn(async () => ({})) },
}));
jest.mock('../models/refreshToken.model', () => ({ create: jest.fn(), update: jest.fn() }));
jest.mock('../models/paiement.model', () => ({ create: jest.fn(async () => ({})) }));
jest.mock('../models/utilisateur.model', () => ({ findByPk: jest.fn(), findOne: jest.fn(), findAll: jest.fn(), create: jest.fn() }));
jest.mock('../services/pricingCalculator.service', () => ({ calculateTotalPrice: jest.fn() }));
jest.mock('../config/security', () => ({ ...jest.requireActual('../config/security'), bcryptConfig: { saltRounds: 4 } }));

const { Colis, Utilisateur, Notifications, ContactFavori } = require('../models');
const Paiement = require('../models/paiement.model');
const db = require('../config/db');
const Pricing = require('../services/pricingCalculator.service');
const { sendSMS } = require('../services/twilio.service');
const Service = require('../services/client/envoieColis.service');

const EXPEDITEUR = { id: 'exp-1' };
const DESTINATAIRE = { id: 'dest-1', role: 'Particulier', statut: 'actif', nom: 'Traoré', prenom: 'Issa', telephone: '+22370000000' };

beforeEach(() => {
  Colis.findOne.mockResolvedValue(null); // référence libre
  Colis.create.mockImplementation(async (v) => ({ id: 'colis-1', ...v }));
  Utilisateur.findByPk.mockResolvedValue(DESTINATAIRE);
  Pricing.calculateTotalPrice.mockResolvedValue({ success: true, data: { total: 42.5, breakdown: { country: 'France' } } });
  delete process.env.PRIX_SERVEUR_OBLIGATOIRE;
});

describe('envoieColis — prix et transport', () => {
  const corps = {
    recepteurId: 'dest-1', poids: 5, prix: 1, destination: 'Ailleurs', type_colis: 'Vêtements',
    countryId: 'pays-fr', shippingType: 'Aérien', needsPickup: 'true', needsDelivery: false,
  };

  it('prix RECALCULÉ côté serveur : le prix envoyé (1 €) est ignoré', async () => {
    const r = await Service.envoieColis({ ...corps, utilisateurConnecte: EXPEDITEUR });
    expect(r.success).toBe(true);
    expect(Pricing.calculateTotalPrice).toHaveBeenCalledWith('pays-fr', 5, 'Aérien', true, false);
    const cree = Colis.create.mock.calls[0][0];
    expect(cree.prix).toBe(42.5);
    expect(cree.destination).toBe('France'); // nom du pays de la grille, pas la saisie libre
    expect(Paiement.create).toHaveBeenCalledWith(expect.objectContaining({ prixTotal: 42.5, statut: 'en_attente', payeurId: 'exp-1' }), expect.anything());
    expect(db.__t.commit).toHaveBeenCalled();
  });

  it.each([['Aérien', 'aerien'], ['maritime', 'maritime'], ['MARITIME', 'maritime']])(
    'type_transport %p enregistré sous la forme canonique %p', async (saisi, attendu) => {
      await Service.envoieColis({ ...corps, shippingType: saisi, utilisateurConnecte: EXPEDITEUR });
      expect(Colis.create.mock.calls[0][0].type_transport).toBe(attendu);
    });

  it('grille sans plage pour ce poids : refus, rien n’est créé, transaction annulée', async () => {
    Pricing.calculateTotalPrice.mockResolvedValue({ success: false, message: 'Aucune plage de poids ne correspond au poids de 500kg' });
    const r = await Service.envoieColis({ ...corps, poids: 500, utilisateurConnecte: EXPEDITEUR });
    expect(r).toEqual({ success: false, message: 'Aucune plage de poids ne correspond au poids de 500kg' });
    expect(Colis.create).not.toHaveBeenCalled();
    expect(db.__t.rollback).toHaveBeenCalled();
  });

  it('ancienne app (prix seul) tolérée… sauf si PRIX_SERVEUR_OBLIGATOIRE=true', async () => {
    const ancien = { recepteurId: 'dest-1', poids: 2, prix: 30, destination: 'Mali', utilisateurConnecte: EXPEDITEUR };
    expect((await Service.envoieColis(ancien)).success).toBe(true);
    expect(Colis.create.mock.calls[0][0].prix).toBe(30);

    process.env.PRIX_SERVEUR_OBLIGATOIRE = 'true';
    const r = await Service.envoieColis(ancien);
    expect(r.success).toBe(false);
    expect(r.message).toMatch(/obsolète/);
  });

  it.each([[0], [-5], ['abc'], [undefined]])('ancienne app, prix %p : refus', async (prix) => {
    const r = await Service.envoieColis({ recepteurId: 'dest-1', poids: 2, prix, destination: 'Mali', utilisateurConnecte: EXPEDITEUR });
    expect(r).toEqual({ success: false, message: 'Prix invalide' });
  });

  it('destination absente (ni destination ni countryId) : refus', async () => {
    const r = await Service.envoieColis({ recepteurId: 'dest-1', poids: 2, prix: 3, utilisateurConnecte: EXPEDITEUR });
    expect(r.message).toBe('La destination est obligatoire');
  });

  it('destinataire = compte administrateur : refusé', async () => {
    Utilisateur.findByPk.mockResolvedValue({ ...DESTINATAIRE, role: 'Admin' });
    const r = await Service.envoieColis({ ...corps, utilisateurConnecte: EXPEDITEUR });
    expect(r.success).toBe(false);
    expect(Colis.create).not.toHaveBeenCalled();
  });

  it('SMS au destinataire envoyé APRÈS validation, sans bloquer la réponse', async () => {
    await Service.envoieColis({ ...corps, utilisateurConnecte: EXPEDITEUR });
    expect(sendSMS).toHaveBeenCalledWith('+22370000000', expect.stringContaining('COL-'));
  });
});

describe('destinataire saisi manuellement', () => {
  const manuel = { prenom: 'Fanta', nom: 'Sidibé', telephone: '+22366000000', email: '', ville: 'Kayes' };

  it('inconnu : compte destinataire LÉGER créé (inactif, compteAuto, mot de passe aléatoire) + contact favori', async () => {
    Utilisateur.findOne.mockResolvedValue(null);
    Utilisateur.create.mockImplementation(async (v) => ({ id: 'auto-1', ...v }));
    ContactFavori.findOne.mockResolvedValue(null);
    const r = await Service.envoieColis({ destinataireManuel: manuel, poids: 3, countryId: 'p', shippingType: 'maritime', utilisateurConnecte: EXPEDITEUR });
    expect(r.success).toBe(true);
    const cree = Utilisateur.create.mock.calls[0][0];
    expect(cree).toMatchObject({ statut: 'inactif', compteAuto: true, role: 'Particulier', telephone: '+22366000000' });
    expect(cree.email).toMatch(/^no-email-.+@nanei\.local$/);
    expect(cree.mot_de_passe).toMatch(/^\$2[aby]\$/);
    expect(Colis.create.mock.calls[0][0].recepteurId).toBe('auto-1');
    expect(ContactFavori.create).toHaveBeenCalledWith(expect.objectContaining({ utilisateur_id: 'exp-1', telephone: '+22366000000' }), expect.anything());
  });

  it('téléphone déjà connu : compte existant réutilisé (pas de doublon)', async () => {
    Utilisateur.findOne.mockResolvedValue({ ...DESTINATAIRE, id: 'existant' });
    await Service.envoieColis({ destinataireManuel: manuel, poids: 3, countryId: 'p', shippingType: 'maritime', utilisateurConnecte: EXPEDITEUR });
    expect(Utilisateur.create).not.toHaveBeenCalled();
    expect(Colis.create.mock.calls[0][0].recepteurId).toBe('existant');
  });

  it('nom ou téléphone manquant : refus', async () => {
    const r = await Service.envoieColis({ destinataireManuel: { prenom: 'A', nom: '' }, poids: 3, countryId: 'p', shippingType: 'maritime', utilisateurConnecte: EXPEDITEUR });
    expect(r.message).toMatch(/prénom et le nom/);
  });
});

describe('envoi groupé (lot)', () => {
  const item = { recepteurId: 'dest-1', poids: 1, countryId: 'p', shippingType: 'aerien' };

  it('lot_id commun, un paiement par colis, prix recalculé pour chacun', async () => {
    const r = await Service.envoieColisLot({ items: [item, item, item], utilisateurConnecte: EXPEDITEUR });
    expect(r.success).toBe(true);
    const lots = new Set(Colis.create.mock.calls.map(([v]) => v.lot_id));
    expect(lots.size).toBe(1);
    expect(Paiement.create).toHaveBeenCalledTimes(3);
    expect(Pricing.calculateTotalPrice).toHaveBeenCalledTimes(3);
  });

  it('un élément invalide : TOUT le lot est annulé', async () => {
    Pricing.calculateTotalPrice
      .mockResolvedValueOnce({ success: true, data: { total: 10, breakdown: { country: 'France' } } })
      .mockResolvedValueOnce({ success: false, message: 'Pays non trouvé' });
    const r = await Service.envoieColisLot({ items: [item, item], utilisateurConnecte: EXPEDITEUR });
    expect(r).toEqual({ success: false, message: 'Pays non trouvé' });
    expect(db.__t.rollback).toHaveBeenCalled();
    expect(db.__t.commit).not.toHaveBeenCalled();
    expect(sendSMS).not.toHaveBeenCalled();
  });

  it('vide, plus de 20 colis, élément incomplet : refus', async () => {
    expect((await Service.envoieColisLot({ items: [], utilisateurConnecte: EXPEDITEUR })).success).toBe(false);
    expect((await Service.envoieColisLot({ items: Array(21).fill(item), utilisateurConnecte: EXPEDITEUR })).message).toMatch(/20 colis/);
    expect((await Service.envoieColisLot({ items: [{ poids: 1, countryId: 'p' }], utilisateurConnecte: EXPEDITEUR })).message).toMatch(/incomplet/);
  });
});

describe('rechercher-client — identifiant EXACT et données masquées', () => {
  const trouve = { id: 'c-9', nom: 'Coulibaly', prenom: 'Mariam', email: 'mariam.coulibaly@gmail.com', telephone: '+22376123456', role: 'Particulier', statut: 'actif', compteAuto: false };

  it('saisie trop courte (< 5) : aucun résultat, aucune requête', async () => {
    expect(await Service.rechercherClient('mar', 'moi')).toEqual({ success: true, data: [] });
    expect(Utilisateur.findOne).not.toHaveBeenCalled();
  });

  it('numéro de moins de 7 chiffres : aucun résultat, aucune requête (même règle que la connexion)', async () => {
    expect(await Service.rechercherClient('76 123', 'moi')).toEqual({ success: true, data: [] });
    expect(await Service.rechercherClient('123456', 'moi')).toEqual({ success: true, data: [] });
    expect(Utilisateur.findOne).not.toHaveBeenCalled();
  });

  it('e-mail exact (casse ignorée) : un seul compte, e-mail et téléphone MASQUÉS', async () => {
    Utilisateur.findOne.mockResolvedValue(trouve);
    const r = await Service.rechercherClient('Mariam.Coulibaly@Gmail.com', 'moi');
    expect(Utilisateur.findOne).toHaveBeenCalledWith({ where: { email: 'mariam.coulibaly@gmail.com' } });
    expect(r.data).toEqual([{ id: 'c-9', nom: 'Coulibaly', prenom: 'Mariam', email: 'ma***@gmail.com', telephone: '+223 ** ** 34 56' }]);
  });

  it('téléphone : passe par la même résolution que la connexion (exact)', async () => {
    Utilisateur.findOne.mockResolvedValue(trouve);
    const r = await Service.rechercherClient('+22376123456', 'moi');
    expect(Utilisateur.findOne).toHaveBeenCalledWith({ where: { telephone: '+22376123456' } });
    expect(r.data).toHaveLength(1);
    expect(r.data[0].telephone).not.toContain('76123456');
  });

  it.each([
    ['administrateur', { role: 'Admin' }],
    ['inactif', { statut: 'inactif' }],
    ['destinataire automatique', { compteAuto: true }],
    ['soi-même', { id: 'moi' }],
  ])('compte %s : jamais renvoyé', async (_l, s) => {
    Utilisateur.findOne.mockResolvedValue({ ...trouve, ...s });
    expect((await Service.rechercherClient('mariam.coulibaly@gmail.com', 'moi')).data).toEqual([]);
  });
});

describe('listes du client — filtre statut et compteurs', () => {
  beforeEach(() => {
    Colis.findAll.mockImplementation(async (opts) => (opts.group
      ? [{ statut: 'en_attente', nombre: '3' }, { statut: 'livre', nombre: '2' }]
      : [{ id: 'a' }]));
    Colis.findAndCountAll.mockResolvedValue({ count: 5, rows: [{ id: 'a' }] });
  });

  it('statut inconnu : refus explicite (avant : erreur Postgres sur l’enum)', async () => {
    expect(await Service.getColisEnvoyes('u', { statut: 'perdu' })).toEqual({ success: false, message: 'Statut invalide (en_attente, recupere, livre)' });
  });

  it('filtre appliqué AVANT la pagination ; par_statut calculé sur TOUS les colis', async () => {
    const r = await Service.getColisRecus('u', { statut: 'livre', page: '1', limit: '1' });
    expect(Colis.findAndCountAll).toHaveBeenCalledWith(expect.objectContaining({ where: { recepteurId: 'u', statut: 'livre' }, limit: 1 }));
    expect(r.par_statut).toEqual({ en_attente: 3, recupere: 0, livre: 2, total: 5 });
    expect(r.pagination).toEqual({ page: 1, limit: 1, total: 5, pages: 5 });
    const requeteCompteurs = Colis.findAll.mock.calls.find(([o]) => o.group)[0];
    expect(requeteCompteurs.where).toEqual({ recepteurId: 'u' }); // sans le filtre de statut
  });

  it('statut « tous » ou absent : pas de filtre, liste complète', async () => {
    const r = await Service.getColisEnvoyes('u', { statut: 'tous' });
    expect(Colis.findAll.mock.calls[0][0].where).toEqual({ expediteurId: 'u' });
    expect(r.pagination).toBeNull();
  });
});

describe('notifications', () => {
  it('non_lues = total des non lues TOUTES pages (badge), 50 dernières sans pagination', async () => {
    Notifications.findAll.mockResolvedValue([{ id: 'n1' }]);
    Notifications.count.mockResolvedValue(12);
    const r = await Service.getNotifications('u', {});
    expect(Notifications.findAll).toHaveBeenCalledWith(expect.objectContaining({ limit: 50, where: { recepteurId: 'u' } }));
    expect(Notifications.count).toHaveBeenCalledWith({ where: { recepteurId: 'u', statut: 'non_lu' } });
    expect(r).toMatchObject({ success: true, non_lues: 12, pagination: null });
  });

  it('marquer lue : seulement SA notification (404 sinon)', async () => {
    Notifications.findOne.mockResolvedValue(null);
    expect(await Service.marquerNotificationCommeLue('n-autre', 'u')).toMatchObject({ success: false, status: 404 });
    expect(Notifications.findOne).toHaveBeenCalledWith({ where: { id: 'n-autre', recepteurId: 'u' } });
  });

  it('tout marquer lu : seulement les siennes, non lues', async () => {
    Notifications.update.mockResolvedValue([4]);
    expect(await Service.marquerToutesNotificationsLues('u')).toEqual({ success: true, nombre: 4 });
    expect(Notifications.update).toHaveBeenCalledWith({ statut: 'lu' }, { where: { recepteurId: 'u', statut: 'non_lu' } });
  });
});

describe('recherche d’un colis par référence (scan QR)', () => {
  it('colis d’un tiers : refusé', async () => {
    Colis.findOne.mockResolvedValue({ expediteurId: 'x', recepteurId: 'y' });
    expect(await Service.rechercherColisParReference('COL-1', 'moi')).toEqual({ success: false, message: 'Ce colis ne vous appartient pas' });
  });

  it('expéditeur ou destinataire : renvoyé', async () => {
    Colis.findOne.mockResolvedValue({ expediteurId: 'x', recepteurId: 'moi' });
    expect((await Service.rechercherColisParReference('COL-1', 'moi')).success).toBe(true);
  });
});
