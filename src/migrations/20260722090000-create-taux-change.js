'use strict';

const crypto = require('crypto');

/**
 * Migration : table taux_change — taux de conversion EUR -> FCFA utilisé
 * pour l'affichage double devise côté mobile. Un seul taux actif géré par
 * l'admin (modifiable, jamais supprimable — voir tauxChange.route.js).
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    if (tables.includes('taux_change')) return;

    await queryInterface.createTable('taux_change', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      devise_source: {
        type: Sequelize.STRING(3),
        allowNull: false,
        defaultValue: 'EUR',
      },
      devise_cible: {
        type: Sequelize.STRING(4),
        allowNull: false,
        defaultValue: 'FCFA',
      },
      valeur: {
        type: Sequelize.FLOAT,
        allowNull: false,
      },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });

    // Taux fixe officiel FCFA (XOF/XAF arrimé à l'euro par le Trésor français)
    await queryInterface.bulkInsert('taux_change', [{
      id: crypto.randomUUID(),
      devise_source: 'EUR',
      devise_cible: 'FCFA',
      valeur: 655.957,
      createdAt: new Date(),
      updatedAt: new Date(),
    }]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('taux_change');
  }
};
