'use strict';

/**
 * Migration : colonne photo_profil sur utilisateur — URL Cloudflare R2 de la
 * photo envoyée via PUT /nanei/account/modifier-profil (champ photoProfil).
 * Avant cette colonne, la photo était téléversée mais jamais enregistrée.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const colonnes = await queryInterface.describeTable('utilisateur');
    if (colonnes.photo_profil) return;

    await queryInterface.addColumn('utilisateur', 'photo_profil', {
      type: Sequelize.STRING(512),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('utilisateur', 'photo_profil');
  },
};
