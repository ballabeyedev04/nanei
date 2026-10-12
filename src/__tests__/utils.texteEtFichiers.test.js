'use strict';

/**
 * Petits utilitaires dont dépendent la sécurité ou l'exactitude des documents.
 *
 * ## Les défauts que ce test rend impossibles
 *
 * - echapperHtml : un prénom, un commentaire ou une description saisis par un
 *   client interprétés comme du HTML dans un e-mail ou une page publique.
 * - sujetEmail : un retour à la ligne dans un sujet d'e-mail (injection
 *   d'en-têtes).
 * - paysDepuisTelephone : l'étiquette affichait « MALI » pour TOUS les
 *   expéditeurs, y compris depuis la France ; « +1 » ne doit pas avaler
 *   « +1… » d'autres indicatifs, un numéro local reste « pays inconnu ».
 * - typeReelFichier : un fichier HTML ou un exécutable renommé « photo.jpg »
 *   accepté parce que le Content-Type déclaré par le client disait image.
 * - typeTransport : « Aérien », « AERIEN », « aérien » doivent tous donner
 *   'aerien' ; une valeur inconnue ne doit pas devenir « maritime ».
 * - statutEchec : « non trouvé » en 400 au lieu de 404, erreur base en 400.
 * - validationNombres : « 4,75 », « abc », '' ou un prix négatif enregistrés
 *   dans une grille tarifaire.
 */

const { echapperHtml, sujetEmail } = require('../utils/echapperHtml');
const { paysDepuisTelephone } = require('../utils/paysDepuisTelephone');
const { typeReelFichier, uploadBufferToR2, createUploader } = require('../middlewares/r2Upload.middleware');
const { normaliserTypeTransport, typeTransportDuColis } = require('../utils/typeTransport');
const { statutEchec } = require('../utils/statutHttp');
const { erreurNombres } = require('../utils/validationNombres');
const r2 = require('../services/r2.service');

describe('echapperHtml / sujetEmail', () => {
  it('neutralise les 5 caractères HTML', () => {
    expect(echapperHtml('<img src=x onerror="alert(1)">&\'')).toBe('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;&amp;&#39;');
  });

  it('null / undefined → chaîne vide ; nombres convertis', () => {
    expect(echapperHtml(null)).toBe('');
    expect(echapperHtml(undefined)).toBe('');
    expect(echapperHtml(12.5)).toBe('12.5');
  });

  it('sujet sur une seule ligne et borné', () => {
    expect(sujetEmail('Objet\r\nBcc: x@y.z')).toBe('Objet Bcc: x@y.z');
    expect(sujetEmail('a'.repeat(400))).toHaveLength(150);
    expect(sujetEmail(null)).toBe('');
  });
});

describe('paysDepuisTelephone', () => {
  const avant = process.env.PAYS_ORIGINE_DEFAUT;
  afterEach(() => { process.env.PAYS_ORIGINE_DEFAUT = avant; });

  it.each([
    ['+22376000000', 'MALI'],
    ['+33612345678', 'FRANCE'],
    ['0033612345678', 'FRANCE'],
    ['+221 77 123 45 67', 'SÉNÉGAL'],
    ['+225-07-00-00-00', "CÔTE D'IVOIRE"],
    ['+352621123456', 'LUXEMBOURG'],
    ['+15145550000', 'ÉTATS-UNIS / CANADA'],
  ])('%s → %s', (tel, pays) => {
    expect(paysDepuisTelephone(tel)).toBe(pays);
  });

  it('numéro local, vide ou indicatif inconnu → pays par défaut (configurable)', () => {
    delete process.env.PAYS_ORIGINE_DEFAUT;
    expect(paysDepuisTelephone('0612345678')).toBe('MALI');
    expect(paysDepuisTelephone(null)).toBe('MALI');
    expect(paysDepuisTelephone('+999123456789')).toBe('MALI');
    process.env.PAYS_ORIGINE_DEFAUT = 'france';
    expect(paysDepuisTelephone('76000000')).toBe('FRANCE');
  });
});

describe('typeReelFichier (nombres magiques)', () => {
  const remplir = (debut) => Buffer.concat([Buffer.from(debut), Buffer.alloc(16)]);

  it('reconnaît PNG, JPEG, WEBP et PDF', () => {
    expect(typeReelFichier(remplir([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toEqual({ mime: 'image/png', extension: 'png' });
    expect(typeReelFichier(remplir([0xff, 0xd8, 0xff, 0xe0]))).toEqual({ mime: 'image/jpeg', extension: 'jpg' });
    expect(typeReelFichier(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 ')]))).toEqual({ mime: 'image/webp', extension: 'webp' });
    expect(typeReelFichier(Buffer.from('%PDF-1.7\n%âãÏÓ\n'))).toEqual({ mime: 'application/pdf', extension: 'pdf' });
  });

  it('refuse HTML, exécutable, SVG, contenu trop court ou non-Buffer', () => {
    expect(typeReelFichier(Buffer.from('<html><script>alert(1)</script></html>'))).toBeNull();
    expect(typeReelFichier(remplir([0x4d, 0x5a]))).toBeNull(); // MZ (exécutable Windows)
    expect(typeReelFichier(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull();
    expect(typeReelFichier(Buffer.from([0xff, 0xd8]))).toBeNull();
    expect(typeReelFichier('pas un buffer')).toBeNull();
  });

  it('uploadBufferToR2 refuse un faux JPEG (400) sans rien envoyer', async () => {
    await expect(uploadBufferToR2(Buffer.from('<html>pas une image</html>'), 'photo.jpg', 'nanei/profils'))
      .rejects.toMatchObject({ status: 400 });
    expect(r2.uploadImage).not.toHaveBeenCalled();
  });

  it('uploadBufferToR2 nomme le fichier d’après le type RÉEL, jamais l’extension fournie', async () => {
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(16)]);
    await uploadBufferToR2(png, '../../evil name.php', 'nanei/preuves');
    expect(r2.uploadImage).toHaveBeenCalledWith(png, expect.stringMatching(/^[\w.-]+\.png$/), 'nanei/preuves');
    const nom = r2.uploadImage.mock.calls[0][1];
    expect(nom).not.toMatch(/\.php|\//);
  });

  it('createUploader refuse un type MIME non autorisé (400) et un fichier trop gros (413)', async () => {
    const express = require('express');
    const request = require('supertest');
    const errorHandler = require('../middlewares/errorHandler.middleware');
    const app = express();
    const uploader = createUploader({ maxFileSize: 64, allowedMimeTypes: ['image/png'] });
    app.post('/f', uploader.single('photo'), (req, res) => res.json({ ok: true }));
    app.use(errorHandler);

    const html = await request(app).post('/f').attach('photo', Buffer.from('<html/>'), { filename: 'a.html', contentType: 'text/html' });
    expect(html.status).toBe(400);
    expect(html.body.message).toBe('Type de fichier non autorisé');

    const gros = await request(app).post('/f').attach('photo', Buffer.alloc(200), { filename: 'a.png', contentType: 'image/png' });
    expect(gros.status).toBe(413);
  });
});

describe('typeTransport', () => {
  it.each([['Aérien', 'aerien'], ['AERIEN', 'aerien'], [' maritime ', 'maritime'], ['bateau', null], [null, null]])(
    'normaliser(%p) → %p', (entree, sortie) => {
      expect(normaliserTypeTransport(entree)).toBe(sortie);
    });

  it('colis : colonne type_transport, sinon type_colis historique, sinon aérien', () => {
    expect(typeTransportDuColis({ type_transport: 'maritime' })).toBe('maritime');
    expect(typeTransportDuColis({ type_transport: null, type_colis: 'Maritime' })).toBe('maritime');
    expect(typeTransportDuColis({ type_colis: 'Vêtements' })).toBe('aerien');
    expect(typeTransportDuColis(null)).toBe('aerien');
  });
});

describe('statutEchec', () => {
  it('statut explicite, « non trouvé » → 404, erreur base → 500, sinon défaut', () => {
    expect(statutEchec({ status: 409 })).toBe(409);
    expect(statutEchec({ message: 'Pays non trouvé' })).toBe(404);
    expect(statutEchec({ message: 'Tarif service non trouvée' })).toBe(404);
    expect(statutEchec({ message: 'Colis introuvable' })).toBe(404);
    expect(statutEchec({ message: 'Erreur', error: 'SequelizeDatabaseError' })).toBe(500);
    expect(statutEchec({ message: 'Données refusées' })).toBe(400);
    expect(statutEchec({ message: 'x' }, 422)).toBe(422);
  });
});

describe('erreurNombres (grilles tarifaires)', () => {
  it('accepte nombres et chaînes numériques, ignore les champs absents', () => {
    expect(erreurNombres([['Prix', 4.75, { strict: true }], ['Min', '0'], ['Max', undefined], ['X', null]])).toBeNull();
  });

  it.each([
    ['4,75'], ['abc'], [''], ['  '], [true], [[1]], [{}], [Infinity], ['Infinity'], [-1],
  ])('refuse %p', (valeur) => {
    expect(erreurNombres([['Prix', valeur]])).toMatch(/^Prix : nombre/);
  });

  it('strict : 0 refusé ; non strict : 0 accepté', () => {
    expect(erreurNombres([['Prix', 0, { strict: true }]])).toMatch(/strictement positif/);
    expect(erreurNombres([['Poids min', 0]])).toBeNull();
  });
});
