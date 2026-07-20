'use strict';

/**
 * Migration : regroupement de colis — ajoute colis.lot_id (UUID nullable).
 * Plusieurs colis envoyés en une seule commande groupée partagent le même
 * lot_id ; null pour un envoi simple (comportement inchangé).
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('colis');
    if (!table.lot_id) {
      await queryInterface.addColumn('colis', 'lot_id', {
        type: Sequelize.UUID,
        allowNull: true,
      });
    }
    try {
      await queryInterface.addIndex('colis', ['lot_id'], { name: 'idx_colis_lot_id' });
    } catch (_) { /* index déjà présent */ }
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('colis', 'lot_id');
  }
};
