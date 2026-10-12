'use strict';

/**
 * ESLint (configuration « flat ») — back Node 22 CommonJS.
 *
 * Objectif : attraper AVANT la production les erreurs que Node ne voit qu'à
 * l'exécution du chemin fautif (variable non définie, import oublié,
 * constante réaffectée, clé d'objet en double, code mort après un return…).
 * Lancé par `npm run lint` et par la chaîne de déploiement (étape 2a) : une
 * seule erreur bloque le déploiement.
 *
 * Règle d'or : on ne désactive PAS une règle globalement pour faire taire
 * des erreurs. Une exception ponctuelle se fait sur la ligne concernée
 * (`// eslint-disable-next-line <règle> -- <justification>`), et la
 * justification est obligatoire (reportUnusedDisableDirectives signale les
 * exceptions devenues inutiles).
 */

const js = require('@eslint/js');
const globals = require('globals');
const nodePlugin = require('eslint-plugin-n');

module.exports = [
  {
    ignores: [
      'node_modules/**',
      'coverage/**',
      'logs/**',
      'uploads/**',
      'backups/**',
      '.tmp-pg/**',
    ],
  },

  // Recommandations officielles : no-undef, no-unused-vars, no-unreachable,
  // no-dupe-keys, no-const-assign, no-dupe-else-if, no-self-assign,
  // no-func-assign, no-import-assign, valid-typeof, use-isnan…
  js.configs.recommended,

  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
    rules: {
      // Variables inutilisées : erreur, sauf les paramètres préfixés « _ » et
      // les paramètres qui précèdent un paramètre utilisé (signature Express
      // `(err, req, res, next)` : `next` doit exister même inutilisé, sinon
      // Express ne reconnaît plus le gestionnaire d'erreurs).
      'no-unused-vars': ['error', {
        args: 'after-used',
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrors: 'none',
        ignoreRestSiblings: true,
      }],
      // Bugs probables supplémentaires (hors « recommended »).
      'no-unreachable-loop': 'error',
      'no-self-compare': 'error',
      'no-template-curly-in-string': 'error',
      'no-unmodified-loop-condition': 'error',
      'no-promise-executor-return': 'error',
      'no-constructor-return': 'error',
      'no-use-before-define': ['error', { functions: false, classes: true, variables: true }],
      'array-callback-return': 'error',
      'no-new-native-nonconstructor': 'error',
      'eqeqeq': ['error', 'smart'],
      'no-var': 'error',
      'no-return-assign': 'error',
      'no-throw-literal': 'error',
    },
  },

  // Imports : un require vers un fichier absent, ou vers un paquet absent de
  // package.json, ne casse qu'à l'exécution du chemin concerné. Pire :
  // un paquet présent seulement en devDependencies fonctionne en local et
  // en test, mais plante dans l'image Docker (installée avec --omit=dev).
  {
    files: ['**/*.js'],
    plugins: { n: nodePlugin },
    rules: {
      'n/no-missing-require': 'error',
      'n/no-extraneous-require': 'error',
      'n/no-deprecated-api': 'error',
      'n/no-path-concat': 'error',
    },
  },
  {
    // Code embarqué dans l'image de production : aucune devDependency.
    files: ['src/**/*.js'],
    ignores: ['src/__tests__/**'],
    plugins: { n: nodePlugin },
    rules: {
      'n/no-unpublished-require': ['error', { allowModules: [] }],
    },
  },

  // Tests Jest
  {
    files: ['src/__tests__/**/*.js', '**/*.test.js'],
    languageOptions: {
      globals: { ...globals.node, ...globals.jest },
    },
  },
];
