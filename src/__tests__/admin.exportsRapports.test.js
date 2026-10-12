'use strict';

/**
 * Exports CSV / Excel, rapport mensuel et alertes quotidiennes (admin).
 *
 * ## Les défauts que ce test rend impossibles
 *
 * Exports
 * - INJECTION DE FORMULES : un nom saisi « =HYPERLINK(…) » exécuté par Excel
 *   à l'ouverture de l'export. Les cellules texte commençant par = + - @
 *   (ou tabulation / retour chariot) sont préfixées d'une apostrophe ; les
 *   nombres restent des nombres.
 * - Date de fin EXCLUE (« jusqu'au 11 » s'arrêtait le 11 à minuit) ; date
 *   invalide ou statut inconnu → 500 au lieu de 400.
 * - Colonne `created_at` toujours vide (attribut Sequelize `createdAt`).
 * Rapport mensuel
 * - CA « NaN » : les montants DECIMAL arrivent en chaînes depuis Postgres.
 * - Rapport financier téléchargeable SANS jeton (/uploads/rapports était
 *   servi en statique) : dossier privé, route admin seulement, traversée de
 *   chemin refusée.
 * Alertes (trouvé en écrivant ce test)
 * - La date de chaque colis était toujours « — » (`c.created_at` au lieu de
 *   `createdAt`) et le nom de l'expéditeur était inséré tel quel dans un
 *   e-mail HTML.
 */

jest.mock('../models', () => ({
  Colis: { findAll: jest.fn() },
  Utilisateur: {},
}));
jest.mock('../models/paiement.model', () => ({ findAll: jest.fn() }));
jest.mock('../models/auditlog.model', () => ({ create: jest.fn(async () => ({})) }));
jest.mock('../middlewares/auth.middleware', () => (req, res, next) => { req.user = { id: 'admin', role: 'Admin' }; next(); });

const fs = require('fs');
const path = require('path');
const express = require('express');
const request = require('supertest');
const { Op } = require('sequelize');
const { Colis } = require('../models');
const Paiement = require('../models/paiement.model');
const htmlToPdf = require('../utils/htmlToPdf');
const { sendEmail } = require('../services/resend.service');
const exportCtrl = require('../controllers/admin/export.controller');
const { genererRapportMensuel } = require('../jobs/rapport.job');
const { verifierColisEnAttente } = require('../jobs/alertes.job');
const { RAPPORTS_DIR } = require('../utils/rapportsStockage');

const app = express();
app.use((req, res, next) => { req.user = { id: 'admin' }; next(); });
app.get('/export/colis', exportCtrl.exportColis);
app.get('/export/paiements', exportCtrl.exportPaiements);

const COLIS = {
  reference: 'COL-1', statut: 'livre', destination: 'France', poids: '2.5', prix: 30, type_transport: 'aerien',
  type_colis: '@SUM(A1:A9)', createdAt: new Date('2026-09-15T10:00:00Z'),
  expediteur: { prenom: '=HYPERLINK("http://piege")', nom: 'X', email: 'e@x.y', telephone: '+33600000000' },
  recepteur: { prenom: 'Awa', nom: 'Diallo', email: 'a@x.y', telephone: '-1' },
};

describe('export des colis', () => {
  it('CSV : formules neutralisées, nombres conservés, created_at renseigné, BOM pour Excel', async () => {
    Colis.findAll.mockResolvedValue([COLIS]);
    const r = await request(app).get('/export/colis');
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toMatch(/text\/csv/);
    expect(r.text.charCodeAt(0)).toBe(0xfeff);
    expect(r.text).toContain('"\'=HYPERLINK(""http://piege"") X"');
    expect(r.text).toContain('"\'@SUM(A1:A9)"');
    expect(r.text).toContain('"\'-1"'); // téléphone texte commençant par « - »
    expect(r.text).toContain('"2.5"');
    expect(r.text).toContain('2026-09-15T10:00:00.000Z');
  });

  it('XLSX : fichier Excel valide, cellules neutralisées', async () => {
    Colis.findAll.mockResolvedValue([COLIS]);
    const r = await request(app).get('/export/colis?format=xlsx').buffer(true).parse((res, cb) => {
      const morceaux = [];
      res.on('data', (m) => morceaux.push(m));
      res.on('end', () => cb(null, Buffer.concat(morceaux)));
    });
    const xlsx = require('xlsx');
    const lignes = xlsx.utils.sheet_to_json(xlsx.read(r.body).Sheets.Colis);
    expect(lignes[0].expediteur_nom.startsWith("'=")).toBe(true);
    expect(lignes[0].prix_eur).toBe(30);
  });

  it('dates : début inclus, fin INCLUSE (jusqu’au lendemain 0 h), filtre statut', async () => {
    Colis.findAll.mockResolvedValue([]);
    await request(app).get('/export/colis?date_debut=2026-10-01&date_fin=2026-10-11&statut=livre');
    const { where } = Colis.findAll.mock.calls[0][0];
    expect(where.statut).toBe('livre');
    expect(where.created_at[Op.gte]).toEqual(new Date('2026-10-01T00:00:00'));
    expect(where.created_at[Op.lt]).toEqual(new Date('2026-10-12T00:00:00'));
  });

  it.each([
    ['/export/colis?date_debut=hier'],
    ['/export/colis?statut=perdu'],
    ['/export/paiements?statut=gratuit'],
    ['/export/paiements?date_fin=2026-13-45'],
  ])('%s → 400 (et non 500)', async (url) => {
    Colis.findAll.mockResolvedValue([]);
    Paiement.findAll.mockResolvedValue([]);
    expect((await request(app).get(url)).status).toBe(400);
  });

  it('export vide : en-têtes quand même présents', async () => {
    Paiement.findAll.mockResolvedValue([]);
    const r = await request(app).get('/export/paiements');
    expect(r.text).toContain('prix_total_eur;montant_paye_eur');
  });

  it('paiements : montants DECIMAL (chaînes) exportés en nombres', async () => {
    Paiement.findAll.mockResolvedValue([{ id: 'p', prixTotal: '20.00', montantPaye: '20.00', statut: 'paye', createdAt: new Date(), colis: { reference: '+33' }, payeur: null }]);
    const r = await request(app).get('/export/paiements');
    expect(r.text).toContain('"20"');
    expect(r.text).toContain('"\'+33"');
  });
});

describe('rapport mensuel', () => {
  it('CA en EUR à partir de montants DECIMAL en chaînes (avant : « NaN »), PDF écrit dans le dossier PRIVÉ', async () => {
    Paiement.findAll.mockResolvedValue([
      { montantPaye: '45.50', colis: { destination: 'France' } },
      { montantPaye: '12.00', colis: { destination: 'France' } },
      { montantPaye: null, prixTotal: '10.25', colis: { destination: '<b>Mali</b>' } },
    ]);
    const r = await genererRapportMensuel();
    expect(r.caTotal).toBe(67.75);
    expect(r.nbColis).toBe(3);
    expect(r.filename).toMatch(/^rapport-\d{4}-\d{2}\.pdf$/);
    const html = htmlToPdf.mock.calls[0][0];
    expect(html).toMatch(/67,75\s€/);
    expect(html).not.toContain('NaN');
    expect(html).not.toContain('<b>Mali</b>');
    expect(fs.existsSync(path.join(RAPPORTS_DIR, r.filename))).toBe(true);
    expect(path.resolve(RAPPORTS_DIR).startsWith(path.resolve(__dirname, '..', 'uploads'))).toBe(false);
  });

  it('seuls les paiements PAYÉS du mois précédent sont comptés', async () => {
    Paiement.findAll.mockResolvedValue([]);
    await genererRapportMensuel();
    const { where } = Paiement.findAll.mock.calls[0][0];
    expect(where.statut).toBe('paye');
    const debut = where.created_at[Op.gte];
    const fin = where.created_at[Op.lt];
    expect(debut.getDate()).toBe(1);
    expect(fin.getDate()).toBe(1);
    expect((fin.getMonth() - debut.getMonth() + 12) % 12).toBe(1);
  });
});

describe('route des rapports (admin)', () => {
  // auth + isAdmin sont contrôlés par routes.authRequise et api.directe ; ici
  // un admin est déjà authentifié pour atteindre les gestionnaires.
  const appRapports = express();
  appRapports.use('/nanei/admin/rapports', require('../routes/admin/rapport.route'));

  beforeAll(() => {
    fs.writeFileSync(path.join(RAPPORTS_DIR, 'rapport-2026-09.pdf'), '%PDF-1.4 test');
  });

  it('liste : nom lisible et URL de la route PROTÉGÉE (jamais /uploads)', async () => {
    const r = await request(appRapports).get('/nanei/admin/rapports');
    const rapport = r.body.rapports.find((x) => x.filename === 'rapport-2026-09.pdf');
    expect(rapport).toMatchObject({ label: 'Septembre 2026', url: '/nanei/admin/rapports/rapport-2026-09.pdf' });
  });

  it('téléchargement d’un rapport existant : PDF', async () => {
    const r = await request(appRapports).get('/nanei/admin/rapports/rapport-2026-09.pdf');
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toBe('application/pdf');
  });

  it.each([
    ['..%2F..%2Fpackage.json', 400],
    ['..%5C..%5Cpackage.json', 400],
    ['rapport-1999-01.pdf', 404],
  ])('%s → %i', async (nom, code) => {
    expect((await request(appRapports).get(`/nanei/admin/rapports/${nom}`)).status).toBe(code);
  });
});

describe('alertes quotidiennes', () => {
  const avant = process.env.EMAIL_ADMIN;
  afterEach(() => { process.env.EMAIL_ADMIN = avant; });

  it('date du colis renseignée (createdAt) et nom de l’expéditeur ÉCHAPPÉ', async () => {
    process.env.EMAIL_ADMIN = 'ops@nanei.test';
    Colis.findAll.mockResolvedValue([{
      reference: 'COL-9', destination: 'Mali', createdAt: new Date('2026-10-01T09:00:00Z'),
      expediteur: { prenom: '<img src=x onerror=alert(1)>', nom: 'Z' },
    }]);
    expect(await verifierColisEnAttente()).toBe(1);
    const { html, to } = sendEmail.mock.calls[0][0];
    expect(to).toBe('ops@nanei.test');
    expect(html).toContain('01/10/2026');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });

  it('aucun colis en retard, ou EMAIL_ADMIN absent : aucun e-mail', async () => {
    Colis.findAll.mockResolvedValue([]);
    expect(await verifierColisEnAttente()).toBe(0);
    process.env.EMAIL_ADMIN = '';
    Colis.findAll.mockResolvedValue([{ reference: 'x', destination: 'y', createdAt: new Date() }]);
    expect(await verifierColisEnAttente()).toBe(0);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('seuls les colis en attente depuis PLUS de 3 jours sont recherchés', async () => {
    Colis.findAll.mockResolvedValue([]);
    await verifierColisEnAttente();
    const { where } = Colis.findAll.mock.calls[0][0];
    expect(where.statut).toBe('en_attente');
    expect(Date.now() - where.created_at[Op.lte].getTime()).toBeGreaterThanOrEqual(3 * 86400000 - 1000);
  });
});
