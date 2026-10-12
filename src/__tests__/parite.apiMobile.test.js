'use strict';

/**
 * Parité des routes : chaque appel HTTP de l'application mobile vise-t-il une
 * route montée (verbe + chemin) ?
 *
 * ## Le défaut que ce test rend impossible
 *
 * Le mobile écrit ses chemins dans `lib/core/config/env.dart` et dans ses
 * datasources. Rien, dans aucun des deux dépôts, n'empêche de renommer une
 * route côté serveur ou de recopier un chemin approximatif côté Flutter : la
 * faute ne se voit ni à la compilation Dart ni au démarrage d'Express, mais en
 * production, sous forme de 404 sur un écran vide (cas réel : le préfixe
 * `/nanei` répété, d'où la rustine `/nanei/nanei/` d'app.js).
 *
 * ## Comment
 *
 * - La table des routes est celle d'app.js + routeurs (helpers/routesMontees).
 * - `env.dart` est lu pour résoudre `Env.xxx` et `Env.xxx(id)` en chemins.
 * - Tous les fichiers .dart de `lib/` sont parcourus : `dio.get(...)`,
 *   `sl<Dio>().post(...)`, `refreshDio.post(...)`… dont l'argument est un
 *   `Env.xxx`, une chaîne `'/…'` ou `'${Env.baseUrl}/…'`.
 * - Chaque chemin déclaré dans `Env` (même s'il est appelé via une fonction
 *   d'aide, ex. la facture PDF) doit correspondre à AU MOINS une route.
 *
 * Il compare des CHEMINS et des VERBES, pas les corps de requête.
 *
 * ## Dépôt mobile absent
 *
 * Les dépôts sont indépendants : sans `C:\nanei` (ou NANEI_MOBILE_DIR), en CI
 * backend seul, le test se déclare non pertinent (skip) au lieu d'échouer.
 */

const fs = require('fs');
const path = require('path');
const { routesMontees, gabarit } = require('./helpers/routesMontees');

const RACINE_MOBILE = process.env.NANEI_MOBILE_DIR || 'C:\\nanei';
const LIB = path.join(RACINE_MOBILE, 'lib');
const ENV_DART = path.join(LIB, 'core', 'config', 'env.dart');
const present = fs.existsSync(ENV_DART);

/** Table « VERBE gabarit » des routes, chemins relatifs à /nanei (baseUrl mobile). */
function table() {
  const t = new Set();
  for (const r of routesMontees()) {
    if (!r.chemin.startsWith('/nanei/')) continue;
    t.add(`${r.methode} ${gabarit(r.chemin.slice('/nanei'.length))}`);
  }
  return t;
}

/** Getters et fonctions de `Env` → chemin brut (`/client/pricing/$countryId`). */
function lireEnv() {
  const src = fs.readFileSync(ENV_DART, 'utf8');
  const env = new Map();
  // static String get x => _get('KEY', '/chemin');
  for (const [, nom, chemin] of src.matchAll(/static\s+String\s+get\s+(\w+)\s*=>\s*_get\(\s*'[^']*'\s*,\s*'([^']*)'\s*\)/g)) env.set(nom, chemin);
  // static String get x => '/chemin';   |   static String x(String id) => '/chemin/$id';
  for (const [, nom, chemin] of src.matchAll(/static\s+String\s+(?:get\s+)?(\w+)(?:\([^)]*\))?\s*=>\s*\n?\s*'([^']*)'/g)) {
    if (!env.has(nom)) env.set(nom, chemin);
  }
  for (const [nom, chemin] of env) env.set(nom, chemin.replace(/^\$baseUrl/, '').replace(/^\$\{baseUrl\}/, ''));
  env.delete('baseUrl');
  return env;
}

/** Appels HTTP du mobile : { methode, chemin, ou }. */
function appelsMobile(env) {
  const appels = [];
  const nonResolus = [];
  const parcourir = (dossier) => {
    for (const e of fs.readdirSync(dossier, { withFileTypes: true })) {
      const complet = path.join(dossier, e.name);
      if (e.isDirectory()) { parcourir(complet); continue; }
      if (!e.name.endsWith('.dart')) continue;
      // Commentaires de fin de ligne retirés (les URL « https:// » sont
      // gardées) : un commentaire placé avant le chemin, dans les parenthèses
      // de l'appel, était pris pour le chemin lui-même.
      const src = fs.readFileSync(complet, 'utf8').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1');
      const fichier = path.relative(LIB, complet).replace(/\\/g, '/');
      for (const m of src.matchAll(/\b(dio|_dio|refreshDio|sl<Dio>\(\))\s*\.(get|post|put|patch|delete)(?:<[^>]*>)?\(\s*([^,)\n]+)/g)) {
        const [, , methode, argBrut] = m;
        const arg = argBrut.trim();
        const ligne = src.slice(0, m.index).split('\n').length;
        const ou = `${fichier}:${ligne}`;
        let chemin = null;
        let e2;
        if ((e2 = /^Env\.(\w+)/.exec(arg))) {
          chemin = env.get(e2[1]);
          if (chemin === undefined) { nonResolus.push(`${arg}  (${ou})`); continue; }
        } else if ((e2 = /^'(?:\$\{Env\.baseUrl\})?(\/[^']*)'$/.exec(arg))) {
          chemin = e2[1];
        } else if ((e2 = /^(_\w+)$/.exec(arg))) {
          // champ privé initialisé depuis dotenv avec un chemin par défaut
          const def = new RegExp(`${e2[1]}\\s*=\\s*[\\s\\S]{0,200}?fallback:\\s*'([^']+)'`).exec(src);
          if (!def) { nonResolus.push(`${arg}  (${ou})`); continue; }
          chemin = def[1];
        } else {
          nonResolus.push(`${arg}  (${ou})`);
          continue;
        }
        appels.push({ methode: methode.toUpperCase(), chemin, ou });
      }
    }
  };
  parcourir(LIB);
  return { appels, nonResolus };
}

const decrire = present ? describe : describe.skip;

decrire('parité des routes mobile ↔ back', () => {
  const routes = present ? table() : new Set();
  const env = present ? lireEnv() : new Map();
  const { appels, nonResolus } = present ? appelsMobile(env) : { appels: [], nonResolus: [] };

  it('les tables sont bien reconstruites', () => {
    // Garde-fou du test lui-même : une table vide ferait tout passer.
    expect(routes.size).toBeGreaterThan(100);
    expect(env.size).toBeGreaterThan(30);
    expect(appels.length).toBeGreaterThan(40);
  });

  it('chaque appel HTTP du mobile est résolu en un chemin', () => {
    expect(nonResolus).toEqual([]);
  });

  it('chaque appel HTTP du mobile vise une route montée (verbe + chemin)', () => {
    const orphelins = appels
      .filter(({ methode, chemin }) => !routes.has(`${methode} ${gabarit(chemin)}`))
      .map(({ methode, chemin, ou }) => `${methode} ${chemin}  (${ou})`);
    expect(orphelins).toEqual([]);
  });

  it('chaque chemin déclaré dans Env correspond à une route (tout verbe)', () => {
    const chemins = new Set([...routes].map((r) => r.split(' ')[1]));
    const orphelins = [...env.entries()]
      .filter(([, c]) => c.startsWith('/') && !chemins.has(gabarit(c)))
      .map(([nom, c]) => `Env.${nom} = ${c}`);
    expect(orphelins).toEqual([]);
  });

  it('aucun chemin ne répète le préfixe /nanei (déjà inclus dans baseUrl)', () => {
    const doubles = [...env.values(), ...appels.map((a) => a.chemin)].filter((c) => /^\/nanei(\/|$)/.test(c));
    expect(doubles).toEqual([]);
  });
});
