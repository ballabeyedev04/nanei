'use strict';

/**
 * Suivi public (GET /nanei/suivi/:reference), étiquette (PDF et ZPL) et
 * facture : documents générés à partir de textes saisis par les clients.
 *
 * ## Les défauts que ce test rend impossibles
 *
 * - Trouvé en écrivant ce test : la page PUBLIQUE de suivi insérait sans
 *   échappement la référence de l'URL (`/nanei/suivi/<script>…` se reflétait
 *   dans la page « introuvable ») et les noms / prénoms / destination saisis
 *   par les clients (un prénom `<img src=x onerror=…>` s'exécutait chez toute
 *   personne qui suit le colis). Même défaut dans l'étiquette et la facture,
 *   rendues par Chromium CÔTÉ SERVEUR (une balise injectée y serait chargée
 *   par le serveur).
 * - Données personnelles complètes exposées publiquement (téléphones masqués,
 *   pas d'e-mail ni d'adresse).
 * - Mode de transport faux sur l'étiquette (« MARITIME » pour un aérien) ou
 *   pays d'origine toujours « MALI ».
 * - Injection de commandes ZPL (`^`, `~`) dans l'étiquette thermique.
 * - Étiquette d'un colis téléchargeable par un autre client.
 */

jest.mock('../models', () => ({
  Colis: { findOne: jest.fn() },
  Utilisateur: {},
  ColisHistorique: {},
}));
jest.mock('../models/colis.model', () => ({ findByPk: jest.fn() }));
jest.mock('../models/utilisateur.model', () => ({}));
jest.mock('../models/country.model', () => ({}));

const express = require('express');
const request = require('supertest');
const { Colis } = require('../models');
const ColisModele = require('../models/colis.model');
const htmlToPdf = require('../utils/htmlToPdf');
const tracking = require('../controllers/tracking.controller');
const etiquette = require('../controllers/client/etiquette.controller');
const { etiquetteHtml } = require('../pdf/etiquette.template');
const { factureHtml } = require('../pdf/facture.template');
const { genererEtiquetteZPL } = require('../pdf/etiquette.zpl');

const XSS = '<img src=x onerror=alert(1)>';

const app = express();
app.use((req, res, next) => { req.user = { id: 'exp-1' }; next(); });
app.get('/suivi/:reference', tracking.suivrePublic);
app.get('/etiquettes/:colisId', etiquette.genererEtiquetteClient);

const colisSuivi = () => ({
  reference: 'COL-2026-A1B2C3-1234', statut: 'recupere', destination: `Paris ${XSS}`, poids: 3, type_colis: 'Maritime',
  type_transport: null, createdAt: new Date('2026-10-01T10:00:00Z'),
  expediteur: { nom: XSS, prenom: 'Awa', telephone: '+22376001234', adresse: 'Rue secrète' },
  recepteur: { nom: 'Diallo', prenom: '"><script>alert(2)</script>', telephone: '0612345678' },
  historique: [
    { toJSON: () => ({ ancien_statut: 'en_attente', nouveau_statut: 'recupere', commentaire: `<b>${XSS}</b>`, created_at: new Date('2026-10-02T10:00:00Z') }) },
  ],
});

describe('suivi public', () => {
  it('référence inconnue reflétée ÉCHAPPÉE dans la page 404', async () => {
    Colis.findOne.mockResolvedValue(null);
    const r = await request(app).get(`/suivi/${encodeURIComponent('<script>alert(1)</script>')}`);
    expect(r.status).toBe(404);
    expect(r.headers['content-type']).toMatch(/text\/html/);
    expect(r.text).not.toContain('<script>alert(1)</script>');
    expect(r.text).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('noms, destination et commentaires saisis : ÉCHAPPÉS dans la page HTML', async () => {
    Colis.findOne.mockResolvedValue(colisSuivi());
    const r = await request(app).get('/suivi/COL-2026-A1B2C3-1234');
    expect(r.status).toBe(200);
    expect(r.text).not.toContain(XSS);
    expect(r.text).not.toContain('<script>alert(2)');
    expect(r.text).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('JSON (?format=json) : téléphones masqués, ni e-mail ni adresse, transport canonique', async () => {
    Colis.findOne.mockResolvedValue(colisSuivi());
    const r = await request(app).get('/suivi/COL-2026-A1B2C3-1234?format=json');
    expect(r.body.colis.expediteur).toEqual({ nom: XSS, prenom: 'Awa', telephone: '+2****34' });
    expect(r.body.colis.recepteur.telephone).toBe('06****78');
    expect(JSON.stringify(r.body)).not.toContain('Rue secrète');
    expect(r.body.colis.type_transport).toBe('maritime');
    expect(r.body.colis.historique).toHaveLength(1);
  });

  it('JSON : référence inconnue → 404 JSON', async () => {
    Colis.findOne.mockResolvedValue(null);
    const r = await request(app).get('/suivi/COL-X?format=json');
    expect(r.status).toBe(404);
    expect(r.body).toEqual({ success: false, message: 'Colis introuvable' });
  });
});

describe('étiquette (client)', () => {
  const colisEtiquette = (s = {}) => ({
    reference: 'COL-1', expediteurId: 'exp-1', destination: 'FRANCE', poids: 2, type_transport: 'aerien',
    createdAt: new Date('2026-10-01T10:00:00Z'),
    expediteur: { nom: XSS, prenom: 'A', telephone: '+33612345678', email: 'e@x.y' },
    recepteur: { nom: 'B^FDINJECT^FS', prenom: '~JA', telephone: '+22370000000', email: 'r@x.y' },
    ...s,
  });

  it('colis d’un autre expéditeur : 403, rien n’est généré', async () => {
    ColisModele.findByPk.mockResolvedValue(colisEtiquette({ expediteurId: 'autre' }));
    expect((await request(app).get('/etiquettes/c-1')).status).toBe(403);
    expect(htmlToPdf).not.toHaveBeenCalled();
  });

  it('PDF : HTML transmis à Chromium ÉCHAPPÉ, pays d’origine déduit du téléphone, transport aérien', async () => {
    ColisModele.findByPk.mockResolvedValue(colisEtiquette());
    const r = await request(app).get('/etiquettes/c-1');
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toBe('application/pdf');
    const html = htmlToPdf.mock.calls[0][0];
    expect(html).not.toContain(XSS);
    expect(html).toContain('FRANCE'); // pays de l'expéditeur (+33)
    expect(html).toContain('AÉRIEN');
    expect(html).toMatch(/data:image\/png;base64/); // vrai QR code
  });

  it('ZPL : caractères de commande ^ et ~ neutralisés', async () => {
    ColisModele.findByPk.mockResolvedValue(colisEtiquette());
    const r = await request(app).get('/etiquettes/c-1?format=zpl');
    expect(r.headers['content-type']).toMatch(/text\/plain/);
    expect(r.text).not.toContain('^FDINJECT');
    expect(r.text).not.toContain('~JA');
  });

  it('génération directe ZPL : structure ^XA … ^XZ', () => {
    const zpl = genererEtiquetteZPL({ reference: 'COL-1', expediteurNom: 'A^B', typeTransport: 'maritime' });
    expect(zpl.trim().startsWith('^XA')).toBe(true);
    expect(zpl.trim().endsWith('^XZ')).toBe(true);
  });

  it('gabarit étiquette : QR code construit sur la référence BRUTE, texte échappé', async () => {
    const html = await etiquetteHtml({ reference: 'COL-<1>', expediteurNom: XSS, typeTransport: 'maritime' });
    expect(html).toContain('COL-&lt;1&gt;');
    expect(html).not.toContain(XSS);
    expect(html).toContain('MARITIME');
  });
});

describe('facture', () => {
  it('textes saisis (payeur, destination, type) échappés ; montants formatés', () => {
    const html = factureHtml({
      factureNumero: 'FCT-2026-ABC', dateEmission: '1 octobre 2026', dateReglement: '2 octobre 2026',
      colisReference: 'COL-1', destination: XSS, poids: '2.0', typeColis: '<i>x</i>',
      payeurPrenom: XSS, payeurNom: 'N', payeurEmail: 'a@b.c', payeurTelephone: '+1',
      prixTotal: '20.00', montantPaye: '20.00', montantXof: 13119, moyenPaiement: 'wave',
    });
    expect(html).not.toContain(XSS);
    expect(html).not.toContain('<i>x</i>');
    expect(html).toMatch(/20,00\s€/);
    expect(html).toMatch(/13\s119 FCFA/);
    expect(html).toContain('Wave');
  });
});
