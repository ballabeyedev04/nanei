'use strict';

/**
 * Listes du client : ce qui part vers le mobile.
 *
 * ## Les défauts que ce test rend impossibles
 *
 * - `GET /paiements` qui transmet au client la charge brute renvoyée par
 *   l'opérateur de paiement (`webhookPayload`).
 * - Un montant payé ABSENT (`null`) transformé en `0` : le mobile ne peut
 *   plus distinguer « rien payé » de « 0 € ».
 * - Les montants DECIMAL renvoyés en chaîne : le mobile lit des nombres.
 * - Contacts favoris : un champ appelé `pays` à l'écriture mais `pays_id` à
 *   la lecture — un client qui renvoie ce qu'il a lu perdait le pays.
 */

jest.mock('../models/paiement.model', () => ({ findAll: jest.fn(), findAndCountAll: jest.fn() }));
jest.mock('../models', () => ({
  ContactFavori: { create: jest.fn(async (v) => ({ id: 'ct-1', ...v })), findOne: jest.fn() },
  Colis: {}, Utilisateur: {},
}));

const Paiement = require('../models/paiement.model');
const { ContactFavori } = require('../models');
const ClientPaiementService = require('../services/client/paiement.service');
const contacts = require('../controllers/client/contact.controller');

const reponse = () => {
  const res = { status: jest.fn(() => res), json: jest.fn(() => res) };
  return res;
};

describe('GET /paiements (client)', () => {
  it('ne renvoie jamais webhookPayload ; nombres pour les DECIMAL ; null conservé', async () => {
    const ligne = (v) => ({ toJSON: () => ({ ...v }) });
    Paiement.findAll
      .mockResolvedValueOnce([
        ligne({ id: 'p1', prixTotal: '45.50', montantPaye: '45.50', statut: 'paye', webhookPayload: { secret: 'x' }, colis: { prix: '45.50', poids: '10.00' } }),
        ligne({ id: 'p2', prixTotal: '12.00', montantPaye: null, statut: 'en_attente', webhookPayload: null }),
      ])
      .mockResolvedValueOnce([{ statut: 'paye', nombre: '1' }, { statut: 'en_attente', nombre: '1' }]);

    const r = await ClientPaiementService.mesPaiements('u1', {});
    expect(r.data[0]).not.toHaveProperty('webhookPayload');
    expect(r.data[1]).not.toHaveProperty('webhookPayload');
    expect(r.data[0]).toMatchObject({ prixTotal: 45.5, montantPaye: 45.5, colis: { prix: 45.5, poids: 10 } });
    expect(r.data[1].montantPaye).toBeNull();
    expect(r.par_statut).toMatchObject({ paye: 1, en_attente: 1, total: 2 });
  });

  it('statut inconnu → 400', async () => {
    const r = await ClientPaiementService.mesPaiements('u1', { statut: 'gratuit' });
    expect(r).toMatchObject({ success: false, status: 400 });
  });
});

describe('contacts favoris : `pays_id` en écriture comme en lecture', () => {
  it('création avec pays_id (nom renvoyé par l’API)', async () => {
    const res = reponse();
    await contacts.creer({ user: { id: 'u1' }, body: { nom: 'Diallo', telephone: '+22376000000', pays_id: 'pays-ml' } }, res);
    expect(ContactFavori.create).toHaveBeenCalledWith(expect.objectContaining({ pays_id: 'pays-ml', utilisateur_id: 'u1' }));
  });

  it('création avec l’ancien nom `pays` : toujours accepté', async () => {
    const res = reponse();
    await contacts.creer({ user: { id: 'u1' }, body: { nom: 'Diallo', telephone: '+22376000000', pays: 'pays-sn' } }, res);
    expect(ContactFavori.create).toHaveBeenCalledWith(expect.objectContaining({ pays_id: 'pays-sn' }));
  });
});
