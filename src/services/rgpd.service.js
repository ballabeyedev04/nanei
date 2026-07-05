const sequelize = require('../config/db');
const Utilisateur = require('../models/utilisateur.model');
const logger = require('../config/logger');

/**
 * Service RGPD pour la suppression de compte complète et irréversible.
 * Supprime TOUTES les données à caractère personnel de l'utilisateur.
 */
class RgpdService {
  /**
   * Supprime complètement le compte utilisateur et ses données associées (HARD DELETE)
   * Conforme à RGPD Art. 17 (droit à l'oubli)
   */
  static async deleteUserAccount(userId) {
    const t = await sequelize.transaction();

    try {
      const utilisateur = await Utilisateur.findByPk(userId, { transaction: t });
      if (!utilisateur) {
        return { success: false, message: 'Utilisateur non trouvé' };
      }

      const userEmail = utilisateur.email;
      const userName = `${utilisateur.prenom} ${utilisateur.nom}`;

      // Supprimer les données personnelles liées
      // SÉCURITÉ: Hard delete des données, pas de soft delete
      const { Notification, MessageClient, Paiement, Colis, Avis, Reclamation } = require('../models');

      // Supprimer les notifications
      await Notification.destroy({
        where: { utilisateurId: userId },
        transaction: t
      });

      // Supprimer les messages
      await MessageClient.destroy({
        where: { utilisateurId: userId },
        transaction: t
      });

      // Supprimer les paiements (hard delete)
      const colis = await Colis.findAll({
        where: { expediteurId: userId },
        attributes: ['id'],
        transaction: t
      });
      const colisIds = colis.map(c => c.id);

      if (colisIds.length > 0) {
        await Paiement.destroy({
          where: { colisId: colisIds },
          transaction: t
        });

        // Supprimer les réclamations liées
        await Reclamation.destroy({
          where: { colisId: colisIds },
          transaction: t
        });

        // Supprimer les avis liés
        await Avis.destroy({
          where: { colisId: colisIds },
          transaction: t
        });
      }

      // Supprimer les colis de l'utilisateur
      await Colis.destroy({
        where: { expediteurId: userId },
        transaction: t
      });

      // Supprimer le compte utilisateur (hard delete)
      await Utilisateur.destroy({
        where: { id: userId },
        transaction: t
      });

      await t.commit();

      logger.info('Compte utilisateur supprimé (RGPD hard delete)', {
        user_id: userId,
        email: userEmail,
        name: userName
      });

      return {
        success: true,
        message: 'Compte et toutes les données associées supprimés définitivement'
      };

    } catch (error) {
      await t.rollback();
      logger.error('Erreur suppression RGPD', { error: error.message, stack: error.stack, user_id: userId });
      throw error;
    }
  }
}

module.exports = RgpdService;
