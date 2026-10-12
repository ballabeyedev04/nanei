'use strict';

/**
 * Table des routes RÉELLEMENT montées par app.js, partagée par les tests de
 * sécurité et de parité.
 *
 * - Les préfixes de montage sont lus dans le TEXTE de app.js
 *   (`app.use('/nanei/…', routeur)`) : c'est la seule source de vérité.
 * - Chaque routeur est ensuite CHARGÉ et sa pile Express est parcourue : on
 *   sait ainsi, par identité de fonction (et non par un nom écrit dans le
 *   code), si `auth.middleware` et `isAdmin` protègent la route — qu'ils
 *   soient passés sur la route ou posés par `router.use(...)` avant elle.
 *
 * Une route ajoutée demain entre automatiquement dans tous les contrôles.
 */

const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '..', '..');

/** Montages `app.use('<préfixe>', <routeur>)` déclarés dans app.js. */
function montages() {
  const src = fs.readFileSync(path.join(SRC, 'app.js'), 'utf8');
  const requires = new Map();
  for (const [, nom, rel] of src.matchAll(/const\s+(\w+)\s*=\s*require\('(\.\/routes\/[^']+)'\)/g)) {
    requires.set(nom, rel);
  }
  const resultat = [];
  for (const [, prefixe, variable] of src.matchAll(/app\.use\(\s*'([^']+)'\s*,\s*(\w+)\s*\)/g)) {
    const rel = requires.get(variable);
    if (!rel) continue; // middleware (limiteur…), pas un routeur
    resultat.push({ prefixe, variable, fichier: require.resolve(path.join(SRC, rel)) });
  }
  return resultat;
}

/** `/nanei/admin` + `/` → `/nanei/admin` ; `/x` + `/:id` → `/x/:id`. */
function joindre(prefixe, sous) {
  const complet = `${prefixe.replace(/\/$/, '')}${sous === '/' ? '' : sous}`;
  return complet || '/';
}

/**
 * Toutes les routes montées : { methode, chemin, fichier, auth, admin }.
 * `chemin` est complet (`/nanei/admin/countries/:id`).
 */
function routesMontees() {
  const auth = require(path.join(SRC, 'middlewares', 'auth.middleware'));
  const isAdmin = require(path.join(SRC, 'middlewares', 'isAdmin.middlewares'));
  const routes = [];
  for (const m of montages()) {
    const routeur = require(m.fichier);
    const gardes = []; // middlewares posés par router.use(...) AVANT la route
    for (const couche of routeur.stack) {
      if (!couche.route) {
        gardes.push(couche.handle);
        continue;
      }
      const chaine = [...gardes, ...couche.route.stack.map((c) => c.handle)];
      for (const methode of Object.keys(couche.route.methods)) {
        if (methode === '_all') continue;
        routes.push({
          methode: methode.toUpperCase(),
          chemin: joindre(m.prefixe, couche.route.path),
          fichier: path.relative(SRC, m.fichier).replace(/\\/g, '/'),
          auth: chaine.includes(auth),
          admin: chaine.includes(isAdmin),
        });
      }
    }
  }
  return routes;
}

/**
 * Gabarit comparable d'un chemin : paramètres Express (`:id`), interpolations
 * Dart (`$id`, `${x.id}`) et JS (`${id}`) deviennent tous `:P` ; chaîne de
 * requête et `/` final retirés.
 */
function gabarit(chemin) {
  return String(chemin)
    .replace(/\?.*$/, '')
    .replace(/\$\{[^}]*\}/g, ':P')
    .replace(/\$\w+/g, ':P')
    .replace(/:\w+/g, ':P')
    .replace(/\/+$/, '') || '/';
}

module.exports = { SRC, montages, routesMontees, gabarit, joindre };
