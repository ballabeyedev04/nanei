'use strict';

/**
 * Paiements Wave / Orange Money : initiation, retour navigateur, webhooks,
 * sur l'application RÉELLE (app.js) — seules les lectures / écritures en base
 * et les opérateurs sont doublés.
 *
 * ## Les défauts que ce test rend impossibles
 *
 * - MONTANT : il venait du client. Il est calculé côté serveur : prix du colis
 *   (EUR) × taux de change actif, arrondi, borné 100 – 10 000 000 XOF.
 * - RETOUR FALSIFIÉ : `/paiements/retour?statut=succes` est une URL publique ;
 *   le paramètre `statut` ne doit JAMAIS valider un paiement. Wave est
 *   interrogé (référence + montant) ; Orange Money attend son webhook.
 * - WEBHOOK FORGÉ : signature HMAC-SHA256 vérifiée sur le CORPS BRUT (avant :
 *   sur un JSON reconstruit, ce qui rejetait des webhooks légitimes), format
 *   Wave `t=…,v1=…` avec horodatage à ±5 min (anti-rejeu), comparaison en
 *   temps constant.
 * - Trouvés en écrivant ce test : un webhook « error » rejoué APRÈS le
 *   paiement repassait un paiement payé en « echoue » ; un webhook « payé »
 *   pour un autre montant validait le colis ; une référence non UUID faisait
 *   lever Postgres (500 rejoué indéfiniment par l'opérateur).
 * - Payer le colis d'un autre, ou payer deux fois.
 */

jest.mock('../middlewares/rateLimit.middleware', () => {
  const passe = (req, res, next) => next();
  return new Proxy({}, { get: (_c, cle) => (cle === '__esModule' ? undefined : passe) });
});

const crypto = require('crypto');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');
const Utilisateur = require('../models/utilisateur.model');
const Paiement = require('../models/paiement.model');
const TauxChange = require('../models/tauxChange.model');
const { Colis } = require('../models');
const Wave = require('../services/payment/wave.service');
const OrangeMoney = require('../services/payment/orangeMoney.service');
const { jwtConfig } = require('../config/security');

const CLIENT = { id: '11111111-1111-4111-8111-111111111111', role: 'Particulier', statut: 'actif', passwordChangedAt: null };
const PAIEMENT_ID = '77777777-7777-4777-8777-777777777777';
const COLIS_ID = '88888888-8888-4888-8888-888888888888';
const jeton = jwt.sign({ id: CLIENT.id, role: 'Particulier' }, jwtConfig.secret, { expiresIn: '5m' });

let paiement;
let colis;

beforeEach(() => {
  colis = { id: COLIS_ID, expediteurId: CLIENT.id, prix: 20 };
  paiement = {
    id: PAIEMENT_ID, colisId: COLIS_ID, payeurId: CLIENT.id, prixTotal: '20.00', montantPaye: '0.00',
    statut: 'en_attente', moyenPaiement: null, referenceTransaction: null,
    update: jest.fn(async function maj(v) { Object.assign(this, v); return this; }),
  };
  jest.spyOn(Utilisateur, 'findByPk').mockResolvedValue({ ...CLIENT });
  jest.spyOn(TauxChange, 'findOne').mockResolvedValue({ valeur: 655.957 });
  jest.spyOn(Colis, 'findOne').mockImplementation(async ({ where }) => (where.id === colis.id && where.expediteurId === colis.expediteurId ? colis : null));
  jest.spyOn(Colis, 'findByPk').mockImplementation(async () => colis);
  jest.spyOn(Paiement, 'findOne').mockImplementation(async () => paiement);
  jest.spyOn(Paiement, 'findByPk').mockImplementation(async (id) => (id === PAIEMENT_ID ? paiement : null));
});

const initier = (corps = { moyenPaiement: 'wave' }, colisId = COLIS_ID) =>
  request(app).post(`/nanei/paiements/${colisId}/initier`).set('Authorization', `Bearer ${jeton}`).send(corps);

describe('POST /paiements/:colisId/initier', () => {
  it('montant XOF = prix (EUR) × taux, arrondi ; le montant envoyé par le client est ignoré', async () => {
    const r = await initier({ moyenPaiement: 'wave', montant: 1, amount: 1 });
    expect(r.status).toBe(200);
    expect(Wave.initierPaiement).toHaveBeenCalledWith(expect.objectContaining({ montant: 13119, reference: PAIEMENT_ID }));
    expect(r.body.data).toMatchObject({ montant: 13119, devise: 'XOF', prixEur: 20, tauxChange: 655.957, checkoutUrl: 'https://pay.wave.test/c/1' });
    expect(paiement.update).toHaveBeenCalledWith(expect.objectContaining({ statut: 'en_cours', moyenPaiement: 'wave', referenceTransaction: 'cos-test' }));
  });

  it('taux modifié par l’admin : pris en compte', async () => {
    TauxChange.findOne.mockResolvedValue({ valeur: 700 });
    await initier();
    expect(Wave.initierPaiement.mock.calls[0][0].montant).toBe(14000);
  });

  it('Orange Money : même montant, URL de notification = webhook signé', async () => {
    await initier({ moyenPaiement: 'orange_money' });
    expect(OrangeMoney.initierPaiement).toHaveBeenCalledWith(expect.objectContaining({
      montant: 13119, orderId: PAIEMENT_ID, notifUrl: expect.stringMatching(/\/nanei\/paiements\/webhook\/orange_money$/),
    }));
  });

  it.each([
    ['montant trop faible', 0.1, /minimum/],
    ['montant trop élevé', 20000, /maximum/],
  ])('%s : 400, l’opérateur n’est pas appelé', async (_l, prix, message) => {
    colis.prix = prix;
    const r = await initier();
    expect(r.status).toBe(400);
    expect(r.body.message).toMatch(message);
    expect(Wave.initierPaiement).not.toHaveBeenCalled();
  });

  it('colis d’un autre client : 400 « non autorisé »', async () => {
    colis.expediteurId = 'quelqu-un-d-autre';
    expect((await initier()).body.message).toBe('Colis non trouvé ou non autorisé');
    expect(Wave.initierPaiement).not.toHaveBeenCalled();
  });

  it('déjà payé : refus', async () => {
    paiement.statut = 'paye';
    expect((await initier()).body.message).toBe('Ce colis est déjà payé');
  });

  it('moyen de paiement inconnu : refus', async () => {
    expect((await initier({ moyenPaiement: 'paypal' })).body.message).toBe('Moyen de paiement invalide');
  });

  it('opérateur en panne : paiement marqué échoué, message propre', async () => {
    Wave.initierPaiement.mockRejectedValueOnce(new Error('timeout of 15000ms exceeded'));
    const r = await initier();
    expect(r.status).toBe(400);
    expect(paiement.update).toHaveBeenCalledWith({ statut: 'echoue' });
  });
});

describe('GET /paiements/retour — ne fait jamais confiance au paramètre `statut`', () => {
  const retour = (statut, ref = PAIEMENT_ID, colisId = COLIS_ID) =>
    request(app).get(`/nanei/paiements/retour?statut=${statut}&colisId=${colisId}&ref=${ref}`);

  it('?statut=succes SANS confirmation Wave : rien n’est écrit, page « en vérification »', async () => {
    Object.assign(paiement, { moyenPaiement: 'wave', referenceTransaction: 'cos-1', statut: 'en_cours' });
    Wave.verifierStatut.mockResolvedValue({ checkout_status: 'processing' });
    const r = await retour('succes');
    expect(r.status).toBe(200);
    expect(r.text).toContain('en cours de vérification');
    expect(paiement.update).not.toHaveBeenCalled();
  });

  it('Wave confirme mais pour un AUTRE montant : non validé', async () => {
    Object.assign(paiement, { moyenPaiement: 'wave', referenceTransaction: 'cos-1', statut: 'en_cours' });
    Wave.verifierStatut.mockResolvedValue({ checkout_status: 'complete', payment_status: 'succeeded', client_reference: PAIEMENT_ID, amount: '100' });
    await retour('succes');
    expect(paiement.statut).toBe('en_cours');
  });

  it('Wave confirme référence ET montant : payé', async () => {
    Object.assign(paiement, { moyenPaiement: 'wave', referenceTransaction: 'cos-1', statut: 'en_cours' });
    Wave.verifierStatut.mockResolvedValue({ checkout_status: 'complete', payment_status: 'succeeded', client_reference: PAIEMENT_ID, amount: '13119' });
    const r = await retour('echec'); // même avec un paramètre contraire
    expect(paiement.statut).toBe('paye');
    expect(paiement.montantPaye).toBe(20);
    expect(r.text).toContain('Paiement réussi');
  });

  it('Orange Money : rien n’est écrit au retour (attente du webhook signé)', async () => {
    Object.assign(paiement, { moyenPaiement: 'orange_money', statut: 'en_cours' });
    await retour('succes');
    expect(paiement.update).not.toHaveBeenCalled();
  });

  it('référence inconnue ou colisId qui ne correspond pas : page d’échec', async () => {
    expect((await retour('succes', '00000000-0000-4000-8000-000000000000')).text).toContain('Paiement échoué');
    expect((await retour('succes', PAIEMENT_ID, '99999999-9999-4999-8999-999999999999')).text).toContain('Paiement échoué');
  });

  it('paramètres injectés dans la page : échappés dans le lien profond', async () => {
    const r = await retour('succes', 'x', '"><script>alert(1)</script>');
    expect(r.text).not.toContain('<script>alert(1)');
  });
});

describe('webhooks — signature sur le corps BRUT', () => {
  const SECRET = process.env.WAVE_WEBHOOK_SECRET;
  const hmac = (secret, contenu) => crypto.createHmac('sha256', secret).update(contenu).digest('hex');
  // Corps brut volontairement « non canonique » (espaces, ordre des clés) :
  // un JSON.stringify(req.body) donnerait une autre signature.
  const brut = (obj) => JSON.stringify(obj, null, 1).replace(/\n/g, '  ');
  const envoyer = (url, corps, entete) => {
    const r = request(app).post(url).set('Content-Type', 'application/json');
    return (entete ? r.set(entete[0], entete[1]) : r).send(corps);
  };
  const corpsWave = (s = {}) => brut({ client_reference: PAIEMENT_ID, checkout_status: 'complete', amount: '13119', ...s });

  it('sans signature : 401, rien n’est lu', async () => {
    const r = await envoyer('/nanei/paiements/webhook/wave', corpsWave());
    expect(r.status).toBe(401);
    expect(Paiement.findByPk).not.toHaveBeenCalled();
  });

  it('format Wave `t=…,v1=…` valide sur le corps brut : paiement validé', async () => {
    const corps = corpsWave();
    const t = Math.floor(Date.now() / 1000);
    const r = await envoyer('/nanei/paiements/webhook/wave', corps, ['Wave-Signature', `t=${t},v1=${hmac(SECRET, `${t}${corps}`)}`]);
    expect(r.status).toBe(200);
    expect(paiement.statut).toBe('paye');
  });

  it('signature calculée sur un JSON RECONSTRUIT (et non le brut) : refusée', async () => {
    const corps = corpsWave();
    const t = Math.floor(Date.now() / 1000);
    const reconstruit = JSON.stringify(JSON.parse(corps));
    const r = await envoyer('/nanei/paiements/webhook/wave', corps, ['Wave-Signature', `t=${t},v1=${hmac(SECRET, `${t}${reconstruit}`)}`]);
    expect(r.status).toBe(401);
  });

  it('horodatage de plus de 5 minutes (rejeu) : 401', async () => {
    const corps = corpsWave();
    const t = Math.floor(Date.now() / 1000) - 600;
    const r = await envoyer('/nanei/paiements/webhook/wave', corps, ['Wave-Signature', `t=${t},v1=${hmac(SECRET, `${t}${corps}`)}`]);
    expect(r.status).toBe(401);
    expect(r.body.error).toBe('Signature expirée');
  });

  it('plusieurs v1 (rotation de secret) : une seule valide suffit', async () => {
    const corps = corpsWave();
    const t = Math.floor(Date.now() / 1000);
    const r = await envoyer('/nanei/paiements/webhook/wave', corps, ['Wave-Signature', `t=${t},v1=${'0'.repeat(64)},v1=${hmac(SECRET, `${t}${corps}`)}`]);
    expect(r.status).toBe(200);
  });

  it('ancien format hexadécimal (X-Signature) et secret Orange Money distinct', async () => {
    const corps = brut({ order_id: PAIEMENT_ID, status: 'SUCCESS', amount: 13119 });
    const mauvais = await envoyer('/nanei/paiements/webhook/orange_money', corps, ['X-Signature', hmac(SECRET, corps)]);
    expect(mauvais.status).toBe(401); // signé avec le secret Wave
    const bon = await envoyer('/nanei/paiements/webhook/orange_money', corps, ['X-Signature', hmac(process.env.ORANGE_MONEY_WEBHOOK_SECRET, corps)]);
    expect(bon.status).toBe(200);
    expect(paiement.statut).toBe('paye');
  });

  it('secret absent de la configuration : 500 (jamais accepté par défaut)', async () => {
    const avant = process.env.WAVE_WEBHOOK_SECRET;
    process.env.WAVE_WEBHOOK_SECRET = '';
    const r = await envoyer('/nanei/paiements/webhook/wave', corpsWave(), ['X-Signature', 'abc']);
    process.env.WAVE_WEBHOOK_SECRET = avant;
    expect(r.status).toBe(500);
  });

  const signer = (corps) => ['X-Signature', hmac(SECRET, corps)];

  it('webhook « error » rejoué APRÈS paiement : le paiement reste payé', async () => {
    paiement.statut = 'paye';
    const corps = corpsWave({ checkout_status: 'error' });
    expect((await envoyer('/nanei/paiements/webhook/wave', corps, signer(corps))).status).toBe(200);
    expect(paiement.update).not.toHaveBeenCalled();
    expect(paiement.statut).toBe('paye');
  });

  it('paiement remboursé : un « complete » rejoué ne le repasse pas en payé', async () => {
    paiement.statut = 'rembourse';
    const corps = corpsWave();
    await envoyer('/nanei/paiements/webhook/wave', corps, signer(corps));
    expect(paiement.statut).toBe('rembourse');
  });

  it('« complete » pour un AUTRE montant : non validé', async () => {
    const corps = corpsWave({ amount: '100' });
    await envoyer('/nanei/paiements/webhook/wave', corps, signer(corps));
    expect(paiement.statut).toBe('en_attente');
  });

  it('référence non UUID : ignorée (200), aucune requête en base', async () => {
    const corps = corpsWave({ client_reference: "1' OR '1'='1" });
    expect((await envoyer('/nanei/paiements/webhook/wave', corps, signer(corps))).status).toBe(200);
    expect(Paiement.findByPk).not.toHaveBeenCalled();
  });

  it('« error » sur un paiement en cours : échoué', async () => {
    paiement.statut = 'en_cours';
    const corps = corpsWave({ checkout_status: 'error' });
    await envoyer('/nanei/paiements/webhook/wave', corps, signer(corps));
    expect(paiement.statut).toBe('echoue');
  });
});

describe('GET /paiements (liste du client)', () => {
  const lister = (q = '') => request(app).get(`/nanei/paiements${q}`).set('Authorization', `Bearer ${jeton}`);

  it('statut inconnu : 400 (avant : erreur Postgres sur l’enum)', async () => {
    const r = await lister('?statut=gratuit');
    expect(r.status).toBe(400);
    expect(r.body.message).toMatch(/Statut invalide/);
  });

  it('filtre statut, montants DECIMAL renvoyés en NOMBRES, par_statut sur tous les paiements', async () => {
    jest.spyOn(Paiement, 'findAll').mockImplementation(async (o) => (o.group
      ? [{ statut: 'paye', nombre: '2' }, { statut: 'en_attente', nombre: '1' }]
      : [{ toJSON: () => ({ id: 'p', prixTotal: '20.00', montantPaye: '0.00', colis: { prix: '20', poids: '2.5' } }) }]));
    const r = await lister('?statut=paye');
    expect(r.status).toBe(200);
    expect(Paiement.findAll.mock.calls.find(([o]) => !o.group)[0].where).toEqual({ payeurId: CLIENT.id, statut: 'paye' });
    expect(r.body.data[0]).toMatchObject({ prixTotal: 20, montantPaye: 0, colis: { prix: 20, poids: 2.5 } });
    expect(r.body.par_statut).toEqual({ en_attente: 1, en_cours: 0, paye: 2, echoue: 0, rembourse: 0, total: 3 });
    expect(Paiement.findAll.mock.calls.find(([o]) => o.group)[0].where).toEqual({ payeurId: CLIENT.id });
  });
});
