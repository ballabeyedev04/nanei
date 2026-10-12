'use strict';

/**
 * Migration : colonne compte_auto sur utilisateur.
 *
 * Marque les comptes destinataires créés automatiquement à l'envoi d'un colis
 * (la personne ne s'est pas encore inscrite). Avant, l'inscription
 * « revendiquait » TOUT compte Particulier inactif portant le même e-mail ou
 * téléphone : un client désactivé par un admin pouvait être repris par
 * n'importe qui, avec un nouveau mot de passe.
 *
 * Reprise de l'existant : un compte Particulier inactif est marqué
 * automatique, SAUF s'il a été désactivé par un admin (ligne DEACTIVATE dans
 * audit_logs) ou s'il s'est déjà connecté (refresh token existant).
 *
 * Remet aussi à NULL les téléphones vides ("").
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const colonnes = await queryInterface.describeTable('utilisateur');
    if (!colonnes.compte_auto) {
      await queryInterface.addColumn('utilisateur', 'compte_auto', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }

    const tables = (await queryInterface.showAllTables()).map((t) => (typeof t === 'string' ? t : t.tableName));
    const exclusions = [];
    if (tables.includes('audit_logs')) {
      exclusions.push(`AND u.id::text NOT IN (
        SELECT entite_id FROM audit_logs WHERE action = 'DEACTIVATE' AND entite_id IS NOT NULL)`);
    }
    if (tables.includes('refresh_tokens')) {
      exclusions.push(`AND u.id NOT IN (SELECT utilisateur_id FROM refresh_tokens WHERE utilisateur_id IS NOT NULL)`);
    }

    // Téléphones vides enregistrés tels quels (création d'admin sans
    // téléphone) : remis à NULL, sinon la colonne UNIQUE bloque le suivant.
    await queryInterface.sequelize.query("UPDATE utilisateur SET telephone = NULL WHERE telephone = ''");

    await queryInterface.sequelize.query(`
      UPDATE utilisateur u SET compte_auto = true
      WHERE u.role = 'Particulier' AND u.statut = 'inactif' AND u.deleted_at IS NULL
      ${exclusions.join('\n      ')}
    `);
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('utilisateur', 'compte_auto');
  },
};
