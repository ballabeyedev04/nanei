'use strict';

/**
 * Cohérence du code lui-même : identifiants définis, dépendances déclarées,
 * variables d'environnement documentées.
 *
 * ## Les défauts que ce test rend impossibles
 *
 * Trouvés en écrivant ce test (corrigés) :
 * - `statutEchec` utilisé sans import dans shippingRate, serviceRate et
 *   tauxChange.controller.js → chaque 404 / 400 devenait une ReferenceError,
 *   donc un 500 ;
 * - `logger` utilisé sans import dans adminAuth.service.js → 500 sur
 *   « mot de passe oublié » admin en production sans FRONTEND_URL ;
 * - `authMiddleware` exporté sans être défini par role.middleware.js ;
 * - `axios` utilisé par Wave / Orange Money mais absent de package.json
 *   (présent par hasard, comme dépendance de twilio) ;
 * - `uuid` (v13, ESM uniquement) importé sans être utilisé dans
 *   account.controller.js — il empêchait de charger l'application sous Jest ;
 * - JWT_RESET_SECRET obligatoire au démarrage mais absent de .env.example
 *   (un serveur installé à partir de l'exemple refusait de démarrer).
 *
 * Aucun de ces défauts ne se voit au démarrage : ils n'éclatent que sur le
 * chemin d'exécution concerné, en production.
 */

const fs = require('fs');
const path = require('path');
const { builtinModules } = require('module');
const { parse } = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const SRC = path.resolve(__dirname, '..');
const RACINE = path.resolve(SRC, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(RACINE, 'package.json'), 'utf8'));

function fichiersSource(dossier = SRC, acc = []) {
  for (const e of fs.readdirSync(dossier, { withFileTypes: true })) {
    const complet = path.join(dossier, e.name);
    if (e.isDirectory()) {
      if (!['__tests__', 'node_modules', 'uploads'].includes(e.name)) fichiersSource(complet, acc);
    } else if (e.name.endsWith('.js')) acc.push(complet);
  }
  return acc;
}

const FICHIERS = fichiersSource();

// Globals Node disponibles sans import. `document` : code évalué DANS
// Chromium (page.evaluate de htmlToPdf.js), pas dans Node.
const GLOBALS = new Set([
  ...Object.getOwnPropertyNames(globalThis),
  'require', 'module', 'exports', '__dirname', '__filename', 'process', 'Buffer', 'console',
  'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate', 'clearImmediate',
  'URL', 'URLSearchParams', 'fetch', 'structuredClone', 'arguments', 'undefined', 'document',
]);

describe('identifiants', () => {
  it('le code source est lu', () => {
    expect(FICHIERS.length).toBeGreaterThan(100);
  });

  it('aucun identifiant utilisé sans être déclaré ou importé (équivalent ESLint no-undef)', () => {
    const fautes = [];
    for (const fichier of FICHIERS) {
      const src = fs.readFileSync(fichier, 'utf8').replace(/^\uFEFF/, '');
      const ast = parse(src, { sourceType: 'script', errorRecovery: false, allowReturnOutsideFunction: true });
      traverse(ast, {
        ReferencedIdentifier(p) {
          const { name } = p.node;
          if (p.parentPath.isMemberExpression({ property: p.node }) && !p.parent.computed) return;
          if (p.scope.hasBinding(name, true) || GLOBALS.has(name)) return;
          fautes.push(`${name}  (${path.relative(SRC, fichier)}:${p.node.loc.start.line})`);
        },
      });
    }
    expect(fautes).toEqual([]);
  });
});

describe('dépendances', () => {
  const externes = new Map();
  for (const fichier of FICHIERS) {
    const src = fs.readFileSync(fichier, 'utf8');
    for (const [, mod] of src.matchAll(/require\(\s*'([^'.][^']*)'\s*\)/g)) {
      const nom = mod.startsWith('@') ? mod.split('/').slice(0, 2).join('/') : mod.split('/')[0];
      if (builtinModules.includes(nom) || nom.startsWith('node:')) continue;
      if (!externes.has(nom)) externes.set(nom, path.relative(SRC, fichier));
    }
  }

  it('chaque paquet requis par le code est déclaré dans `dependencies` (pas seulement présent par transitivité)', () => {
    const manquants = [...externes].filter(([nom]) => !(pkg.dependencies || {})[nom]).map(([nom, f]) => `${nom}  (${f})`);
    expect(manquants).toEqual([]);
  });

  it('aucun paquet « ESM uniquement » n’est chargé par require() dans le code (incompatible avec Jest et Node < 22)', () => {
    const esm = [...externes.keys()].filter((nom) => {
      try {
        const p = JSON.parse(fs.readFileSync(path.join(RACINE, 'node_modules', nom, 'package.json'), 'utf8'));
        const exp = p.exports && (p.exports['.'] || p.exports);
        const aCjs = typeof exp === 'object' && exp !== null && JSON.stringify(exp).includes('"require"');
        return p.type === 'module' && !aCjs;
      } catch { return false; }
    });
    expect(esm).toEqual([]);
  });
});

describe('variables d’environnement', () => {
  it('chaque secret OBLIGATOIRE au démarrage figure dans .env.example', () => {
    const securite = fs.readFileSync(path.join(SRC, 'config', 'security.js'), 'utf8');
    const liste = /\[((?:\s*'[A-Z_]+'\s*,?)+)\]\.filter\(k => !process\.env\[k\]\)/.exec(securite);
    expect(liste).not.toBeNull();
    const obligatoires = [...liste[1].matchAll(/'([A-Z_]+)'/g)].map(([, v]) => v);
    expect(obligatoires).toEqual(expect.arrayContaining(['JWT_SECRET', 'JWT_REFRESH_SECRET', 'JWT_RESET_SECRET']));
    const exemple = fs.readFileSync(path.join(RACINE, '.env.example'), 'utf8');
    const absentes = obligatoires.filter((v) => !new RegExp(`^${v}=`, 'm').test(exemple));
    expect(absentes).toEqual([]);
  });

  it('les secrets des webhooks de paiement sont documentés', () => {
    const exemple = fs.readFileSync(path.join(RACINE, '.env.example'), 'utf8');
    expect(exemple).toMatch(/^WAVE_WEBHOOK_SECRET=/m);
    expect(exemple).toMatch(/^ORANGE_MONEY_WEBHOOK_SECRET=/m);
  });
});
