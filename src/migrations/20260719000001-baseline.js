'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Migration de référence (baseline) — marque le point de départ du système
 * de migrations versionnées pour Nanei.
 *
 * Le schéma existant a été créé jusqu'ici par `sequelize.sync({ alter: true })`
 * au démarrage du serveur, sans aucune traçabilité des changements de
 * structure — risque de perte/altération silencieuse de colonnes en
 * production. À partir de maintenant, tout changement de schéma doit passer
 * par une nouvelle migration ici (`npx sequelize-cli migration:generate --name ...`),
 * exécutée via `npm run migrate`. server.js n'utilise plus `sync({ alter: true })`
 * qu'en développement (voir src/server.js).
 *
 * ── Base existante (production) ─────────────────────────────────────────────
 * Ne fait rien : le schéma existe déjà ; elle amorce seulement SequelizeMeta.
 * (Déjà appliquée en production : ce code n'y est plus jamais exécuté.)
 *
 * ── Base NEUVE (nouvelle installation, test de démarrage du CI) ─────────────
 * Avant, `npm run migrate` échouait sur une base vide : la migration suivante
 * (add-lot-id-to-colis) lit la table `colis`, qui n'existait pas encore —
 * elle n'était créée qu'au démarrage du serveur (sync), donc APRÈS les
 * migrations (deploy/release.sh). Une installation neuve ne pouvait pas être
 * déployée par la chaîne. Désormais, sur une base sans table `utilisateur`,
 * la baseline crée le schéma à partir des modèles (exactement ce que fait
 * server.js au démarrage), puis les migrations suivantes, toutes
 * idempotentes, ne font que compléter les données.
 * `taux_change` est laissée à sa propre migration (qui insère le taux
 * officiel EUR → FCFA).
 */
module.exports = {
  async up(queryInterface) {
    const tables = (await queryInterface.showAllTables()).map((t) => (typeof t === 'string' ? t : t.tableName));
    if (tables.includes('utilisateur')) return; // base existante : rien à faire

    // Mêmes modèles que l'application : index.js (associations) + tous les
    // fichiers *.model.js (certains ne sont chargés que par app.js).
    const dossier = path.join(__dirname, '..', 'models');
    require(path.join(dossier, 'index.js'));
    for (const fichier of fs.readdirSync(dossier).filter((f) => f.endsWith('.model.js')).sort()) {
      require(path.join(dossier, fichier));
    }
    const sequelize = require('../config/db');
    try {
      await sequelize.sync({ force: false });
      await sequelize.query('DROP TABLE IF EXISTS taux_change');
    } finally {
      // Connexion propre à l'application : la fermer pour que le CLI se termine.
      await sequelize.close();
    }
  },
  async down() {
    // no-op
  }
};
