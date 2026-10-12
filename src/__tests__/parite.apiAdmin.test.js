'use strict';

/**
 * Parité des routes : chaque appel HTTP de l'interface d'administration
 * (admin-nanei, `src/api/*.ts`) vise-t-il une route montée ?
 *
 * ## Le défaut que ce test rend impossible
 *
 * L'admin écrit ses chemins en dur (`api.put(\`/admin/activer-admin/${id}\`)`).
 * Un renommage côté back, une route retirée (ex. GET /admin/hello) ou un
 * verbe recopié de travers (PUT au lieu de PATCH) ne se voit ni à la
 * compilation TypeScript ni au démarrage d'Express : seulement en production,
 * par un 404 sur un bouton.
 *
 * ## Comment
 *
 * `baseURL` de l'admin contient déjà `/nanei` (VITE_API_URL ou '/nanei') : les
 * chemins relatifs sont donc comparés à la table d'app.js privée de `/nanei`.
 * Les appels sont lus dans `src/api/*.ts` (`api.get(...)`,
 * `refreshClient.post(...)`, y compris sur plusieurs lignes et avec un type
 * générique `api.get<…>(`).
 *
 * ## Dépôt admin absent
 *
 * Sans `../admin-nanei` (ou NANEI_ADMIN_DIR) — CI backend seul — le test se
 * déclare non pertinent (skip) au lieu d'échouer.
 */

const fs = require('fs');
const path = require('path');
const { routesMontees, gabarit } = require('./helpers/routesMontees');

const RACINE_ADMIN = process.env.NANEI_ADMIN_DIR || path.resolve(__dirname, '..', '..', '..', 'admin-nanei');
const API = path.join(RACINE_ADMIN, 'src', 'api');
const present = fs.existsSync(API);

function table() {
  const t = new Set();
  for (const r of routesMontees()) {
    if (r.chemin.startsWith('/nanei/')) t.add(`${r.methode} ${gabarit(r.chemin.slice('/nanei'.length))}`);
  }
  return t;
}

/** Saute un éventuel type générique `<…>` (imbriqué) après `.get`. */
function apresGenerique(src, i) {
  if (src[i] !== '<') return i;
  let profondeur = 0;
  for (let j = i; j < src.length; j += 1) {
    if (src[j] === '<') profondeur += 1;
    else if (src[j] === '>') { profondeur -= 1; if (profondeur === 0) return j + 1; }
  }
  return i;
}

function appelsAdmin() {
  const appels = [];
  for (const nom of fs.readdirSync(API).filter((f) => f.endsWith('.ts'))) {
    const src = fs.readFileSync(path.join(API, nom), 'utf8');
    for (const m of src.matchAll(/\b(api|refreshClient)\.(get|post|put|patch|delete)\b/g)) {
      let i = apresGenerique(src, m.index + m[0].length);
      if (src[i] !== '(') continue;
      const suite = src.slice(i + 1).trimStart();
      const lit = /^(['`])([^'`]*)\1/.exec(suite);
      const ligne = src.slice(0, m.index).split('\n').length;
      appels.push({ methode: m[2].toUpperCase(), chemin: lit ? lit[2] : null, brut: suite.slice(0, 40), ou: `src/api/${nom}:${ligne}` });
    }
  }
  return appels;
}

const decrire = present ? describe : describe.skip;

decrire('parité des routes admin ↔ back', () => {
  const routes = present ? table() : new Set();
  const appels = present ? appelsAdmin() : [];

  it('les tables sont bien reconstruites', () => {
    expect(routes.size).toBeGreaterThan(100);
    expect(appels.length).toBeGreaterThan(60);
  });

  it('chaque appel a un chemin littéral analysable', () => {
    expect(appels.filter((a) => a.chemin === null).map((a) => `${a.methode} ${a.brut}  (${a.ou})`)).toEqual([]);
  });

  it('chaque appel de l’admin vise une route montée (verbe + chemin)', () => {
    const orphelins = appels
      .filter((a) => a.chemin !== null && !routes.has(`${a.methode} ${gabarit(a.chemin)}`))
      .map((a) => `${a.methode} ${a.chemin}  (${a.ou})`);
    expect(orphelins).toEqual([]);
  });

  it('aucun chemin ne répète le préfixe /nanei (déjà dans baseURL)', () => {
    expect(appels.filter((a) => a.chemin && /^\/nanei(\/|$)/.test(a.chemin)).map((a) => a.ou)).toEqual([]);
  });
});
