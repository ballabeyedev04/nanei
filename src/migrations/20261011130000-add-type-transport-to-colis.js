'use strict';

/**
 * Migration : colis.type_transport ('aerien' | 'maritime', sans accent).
 * Avant cette colonne, le mode de transport choisi à l'envoi n'était stocké
 * nulle part et les gabarits (étiquette, ZPL, suivi public) le lisaient à
 * tort dans type_colis, qui contient la NATURE du colis (« Vêtement »…).
 *
 * Reprise des données : les colis dont type_colis contient déjà un mode de
 * transport (« aérien », « aerien », « maritime ») sont recopiés.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('colis');
    if (!table.type_transport) {
      await queryInterface.addColumn('colis', 'type_transport', {
        type: Sequelize.STRING(20),
        allowNull: true,
      });
    }
    await queryInterface.sequelize.query(`
      UPDATE colis SET type_transport = 'aerien'
      WHERE type_transport IS NULL AND lower(type_colis) IN ('aérien', 'aerien')
    `);
    await queryInterface.sequelize.query(`
      UPDATE colis SET type_transport = 'maritime'
      WHERE type_transport IS NULL AND lower(type_colis) = 'maritime'
    `);
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('colis', 'type_transport');
  },
};
