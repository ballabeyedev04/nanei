'use strict';

/**
 * GET /health — sonde de santé lue par Docker, deploy/release.sh, la chaîne
 * de déploiement (.github/workflows/deploy.yml) et l'admin.
 *
 * ## Les défauts que ce test rend impossibles
 *
 * 1. Une sonde qui répond 200 alors que la base est injoignable. Avant, /health
 *    renvoyait `{ status: 'OK' }` sans rien vérifier : un backend coupé de sa
 *    base passait le contrôle de déploiement et restait en service.
 * 2. Une sonde qui reste pendue quand la base ne répond pas (le pool attend
 *    30 s) : le contrôle de déploiement et Docker conclueraient trop tard.
 * 3. Une fuite d'information sur une route publique (message d'erreur SQL,
 *    hôte de la base…) dans la réponse 503.
 * 4. Un contrat cassé avec l'admin : `api` doit être un entier (l'admin
 *    refuse de se déployer si `api` < sa constante minimale) et `version` le
 *    commit injecté dans l'image (GIT_SHA), « dev » hors image.
 */

jest.mock('../middlewares/rateLimit.middleware', () => {
  const passe = (req, res, next) => next();
  return new Proxy({}, { get: (_cible, cle) => (cle === '__esModule' ? undefined : passe) });
});

const request = require('supertest');

function chargerApp({ gitSha, delaiMs } = {}) {
  jest.resetModules();
  if (gitSha === undefined) delete process.env.GIT_SHA; else process.env.GIT_SHA = gitSha;
  if (delaiMs === undefined) delete process.env.HEALTH_DB_TIMEOUT_MS; else process.env.HEALTH_DB_TIMEOUT_MS = String(delaiMs);
  const app = require('../app');
  const sequelize = require('../config/db');
  const { API_VERSION } = require('../config/version');
  return { app, sequelize, API_VERSION };
}

afterEach(() => {
  delete process.env.GIT_SHA;
  delete process.env.HEALTH_DB_TIMEOUT_MS;
});

describe('GET /health', () => {
  it('base joignable : 200 avec status, db, version et api (entier)', async () => {
    const { app, sequelize, API_VERSION } = chargerApp({ gitSha: 'abc123def4567890abc123def4567890abc123de' });
    const authentifier = jest.spyOn(sequelize, 'authenticate').mockResolvedValue();

    const r = await request(app).get('/health');

    expect(authentifier).toHaveBeenCalledTimes(1);
    expect(r.status).toBe(200);
    expect(r.body).toEqual({
      status: 'OK',
      db: 'ok',
      version: 'abc123def4567890abc123def4567890abc123de',
      api: API_VERSION,
    });
    expect(Number.isInteger(r.body.api)).toBe(true);
    expect(r.body.api).toBeGreaterThanOrEqual(1);
    expect(r.headers['cache-control']).toBe('no-store');
  });

  it('sans GIT_SHA (poste local, tests) : version « dev »', async () => {
    const { app, sequelize } = chargerApp();
    jest.spyOn(sequelize, 'authenticate').mockResolvedValue();
    const r = await request(app).get('/health');
    expect(r.status).toBe(200);
    expect(r.body.version).toBe('dev');
  });

  it('base injoignable : 503 { status: KO, db: erreur } sans aucun détail technique', async () => {
    const { app, sequelize } = chargerApp({ gitSha: 'abc123' });
    jest.spyOn(sequelize, 'authenticate').mockRejectedValue(
      new Error('connect ECONNREFUSED 10.0.0.5:5432 — password authentication failed for user "nanei"'),
    );

    const r = await request(app).get('/health');

    expect(r.status).toBe(503);
    expect(r.body).toEqual({ status: 'KO', db: 'erreur' });
    expect(JSON.stringify(r.body)).not.toMatch(/ECONN|5432|password|nanei|abc123/);
  });

  it('base qui ne répond pas : 503 après le délai court, pas de requête pendue', async () => {
    const { app, sequelize } = chargerApp({ delaiMs: 50 });
    jest.spyOn(sequelize, 'authenticate').mockReturnValue(new Promise(() => {}));

    const debut = Date.now();
    const r = await request(app).get('/health');

    expect(r.status).toBe(503);
    expect(r.body).toEqual({ status: 'KO', db: 'erreur' });
    expect(Date.now() - debut).toBeLessThan(5000);
  });

  it('publique : aucun jeton requis', async () => {
    const { app, sequelize } = chargerApp();
    jest.spyOn(sequelize, 'authenticate').mockResolvedValue();
    const r = await request(app).get('/health').set('Authorization', 'Bearer jeton-invalide');
    expect(r.status).toBe(200);
  });
});

describe('API_VERSION (contrat avec l’admin)', () => {
  it('est un entier strictement positif', () => {
    const { API_VERSION } = require('../config/version');
    expect(Number.isInteger(API_VERSION)).toBe(true);
    expect(API_VERSION).toBeGreaterThan(0);
  });
});
