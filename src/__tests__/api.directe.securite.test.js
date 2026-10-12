'use strict';

/**
 * L'API attaquée DIRECTEMENT, sans passer par l'admin ni par le mobile.
 *
 * ## Le défaut que ce test rend impossible
 *
 * L'attaquant n'a que l'URL de l'API, son propre compte et son jeton. Il peut
 * réécrire le rôle dans le jeton, rejouer un jeton émis avant un changement
 * de mot de passe, utiliser un compte désactivé, appeler n'importe quelle
 * route. Aucune garde React ou Flutter ne s'interpose : seul le back décide.
 *
 * On monte l'application RÉELLE (app.js) avec supertest ; seule la lecture
 * de l'utilisateur en base (`Utilisateur.findByPk`) est doublée — c'est elle
 * que auth.middleware consulte à chaque requête, et c'est précisément ce qui
 * rend inopérant un rôle falsifié dans le jeton.
 *
 * La liste des routes /nanei/admin/** n'est pas écrite à la main : elle est
 * lue dans app.js et les routeurs (helpers/routesMontees.js).
 */

// Limiteurs neutralisés : toutes les requêtes partent de la même IP. Un Proxy
// plutôt qu'une liste : TOUT limiteur exporté, y compris un limiteur ajouté
// demain, devient un passe-plat (sinon app.js refuse de se monter).
jest.mock('../middlewares/rateLimit.middleware', () => {
  const passe = (req, res, next) => next();
  return new Proxy({}, { get: (_cible, cle) => (cle === '__esModule' ? undefined : passe) });
});

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');
const Utilisateur = require('../models/utilisateur.model');
const { jwtConfig } = require('../config/security');
const { routesMontees } = require('./helpers/routesMontees');

const UUID = '44444444-4444-4444-8444-444444444444';

const COMPTES = {
  client: { id: '11111111-1111-4111-8111-111111111111', role: 'Particulier', statut: 'actif', passwordChangedAt: null },
  admin: { id: '22222222-2222-4222-8222-222222222222', role: 'Admin', statut: 'actif', passwordChangedAt: null },
  adminInactif: { id: '33333333-3333-4333-8333-333333333333', role: 'Admin', statut: 'inactif', passwordChangedAt: null },
  clientInactif: { id: '55555555-5555-4555-8555-555555555555', role: 'Particulier', statut: 'inactif', passwordChangedAt: null },
  // Mot de passe changé il y a 10 minutes.
  mdpChange: { id: '66666666-6666-4666-8666-666666666666', role: 'Admin', statut: 'actif', passwordChangedAt: new Date(Date.now() - 10 * 60 * 1000) },
};

/** Jeton d'accès authentique (vrai secret), contenu surchargeable. */
const jeton = (compte, surcharge = {}, options = { expiresIn: '5m' }) =>
  jwt.sign({ id: compte.id, role: compte.role, ...surcharge }, jwtConfig.secret, options);

beforeEach(() => {
  jest.spyOn(Utilisateur, 'findByPk').mockImplementation(async (id) => {
    const c = Object.values(COMPTES).find((x) => x.id === id);
    return c ? { ...c } : null;
  });
});

const ADMIN = routesMontees()
  .filter((r) => r.chemin.startsWith('/nanei/admin/') && r.auth)
  .map((r) => [`${r.methode} ${r.chemin}`, r.methode.toLowerCase(), r.chemin.replace(/:\w+/g, UUID)]);

const appel = (methode, url, jetonAcces) => {
  const r = request(app)[methode](url);
  return jetonAcces ? r.set('Authorization', `Bearer ${jetonAcces}`) : r;
};

describe('périmètre', () => {
  it('toutes les routes d’administration sont couvertes', () => {
    // Garde-fou : si la lecture échouait, les tests suivants ne vérifieraient rien.
    expect(ADMIN.length).toBeGreaterThanOrEqual(50);
  });
});

describe('API d’administration — chaque route /nanei/admin/*', () => {
  it.each(ADMIN)('%s — sans jeton : 401', async (_l, methode, url) => {
    expect((await appel(methode, url)).status).toBe(401);
  });

  it.each(ADMIN)('%s — jeton d’un client : 403', async (_l, methode, url) => {
    expect((await appel(methode, url, jeton(COMPTES.client))).status).toBe(403);
  });

  it.each(ADMIN)('%s — rôle « Admin » FALSIFIÉ dans le jeton d’un client : 403', async (_l, methode, url) => {
    // Jeton authentique (vrai secret), rôle réécrit : le serveur relit le
    // rôle EN BASE (Particulier) à chaque requête, le jeton n'en décide pas.
    const falsifie = jeton(COMPTES.client, { role: 'Admin' });
    expect((await appel(methode, url, falsifie)).status).toBe(403);
  });

  it.each(ADMIN)('%s — compte admin DÉSACTIVÉ : 403', async (_l, methode, url) => {
    expect((await appel(methode, url, jeton(COMPTES.adminInactif))).status).toBe(403);
  });
});

describe('jetons invalides, périmés ou détournés', () => {
  const URL = '/nanei/admin/liste-admins';

  it('signé avec un autre secret : 401', async () => {
    const autre = jwt.sign({ id: COMPTES.admin.id, role: 'Admin' }, 'secret-de-l-attaquant', { expiresIn: '5m' });
    expect((await appel('get', URL, autre)).status).toBe(401);
  });

  it('algorithme « none » (non signé) : 401', async () => {
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const nonSigne = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ id: COMPTES.admin.id, role: 'Admin' })}.`;
    expect((await appel('get', URL, nonSigne)).status).toBe(401);
  });

  it('expiré : 401', async () => {
    const expire = jeton(COMPTES.admin, { exp: Math.floor(Date.now() / 1000) - 60 }, {});
    expect((await appel('get', URL, expire)).status).toBe(401);
  });

  it('refresh token présenté comme jeton d’accès : 401', async () => {
    const refresh = jwt.sign({ id: COMPTES.admin.id, role: 'Admin' }, jwtConfig.refreshSecret, { expiresIn: '7d' });
    expect((await appel('get', URL, refresh)).status).toBe(401);
  });

  it('jeton émis AVANT le dernier changement de mot de passe : 401', async () => {
    const ancien = jeton(COMPTES.mdpChange, { iat: Math.floor(Date.now() / 1000) - 3600 }, { expiresIn: '2h' });
    const r = await appel('get', '/nanei/account/me', ancien);
    expect(r.status).toBe(401);
    expect(r.body.message).toMatch(/changement de mot de passe/);
  });

  it('jeton émis APRÈS le changement de mot de passe : accepté', async () => {
    // Liste des rapports : lue sur disque (dossier jetable des tests), aucune base.
    const recent = jeton(COMPTES.mdpChange);
    const r = await appel('get', '/nanei/admin/rapports', recent);
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.rapports)).toBe(true);
  });

  it('compte client désactivé, route client : 403', async () => {
    expect((await appel('get', '/nanei/client/colis-envoyes', jeton(COMPTES.clientInactif))).status).toBe(403);
  });

  it('compte supprimé depuis l’émission du jeton : refusé', async () => {
    const fantome = { ...COMPTES.admin, id: UUID };
    expect([401, 404]).toContain((await appel('get', URL, jeton(fantome))).status);
  });

  it('en-tête sans le préfixe Bearer : 401', async () => {
    const r = await request(app).get(URL).set('Authorization', jeton(COMPTES.admin));
    expect(r.status).toBe(401);
  });
});

describe('fichiers et routes hors /nanei', () => {
  it('GET /health répond OK sans jeton', async () => {
    const r = await request(app).get('/health');
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ status: 'OK' });
  });

  it('les rapports financiers ne sont jamais servis en statique (/uploads/rapports → 404)', async () => {
    const r = await request(app).get('/uploads/rapports/rapport-2026-09.pdf');
    expect(r.status).toBe(404);
  });

  it('le préfixe doublé /nanei/nanei/ est réécrit (compat mobile) et reste protégé', async () => {
    expect((await request(app).get('/nanei/nanei/account/me')).status).toBe(401);
  });

  it('une route inconnue ne révèle pas de pile d’erreur', async () => {
    const r = await request(app).get('/nanei/route-inexistante');
    expect(r.status).toBe(404);
    expect(r.text).not.toMatch(/node_modules|at \S+\.js:\d+/);
  });
});
