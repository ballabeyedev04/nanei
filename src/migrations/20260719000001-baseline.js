'use strict';

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
 * Cette migration elle-même ne fait rien (le schéma existe déjà) — elle sert
 * uniquement à amorcer la table SequelizeMeta de suivi des migrations.
 */
module.exports = {
  async up() {
    // no-op : schéma déjà existant, créé historiquement via sync({alter:true})
  },
  async down() {
    // no-op
  }
};
