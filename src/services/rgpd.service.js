const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { Op } = require('sequelize');
const sequelize = require('../config/db');
const logger = require('../config/logger');
const {
  Utilisateur, Notifications, Avis, Reclamation, ContactFavori, RefreshToken,
} = require('../models');

/**
 * Service RGPD — suppression de compte (Art. 17, droit à l'effacement).
 *
 * Effacement par ANONYMISATION, en une transaction :
 *  - le compte perd toute donnée personnelle (nom, prénom, e-mail, téléphone,
 *    adresse, photo, jeton push) et tout moyen de connexion (mot de passe
 *    aléatoire, refresh tokens supprimés), puis il est désactivé et marqué
 *    supprimé (soft delete) ;
 *  - les données qui ne servent qu'à lui sont supprimées : notifications,
 *    contacts favoris, avis et réclamations qu'il a rédigés ;
 *  - les colis et paiements sont CONSERVÉS (obligation de conservation
 *    comptable et litiges des autres utilisateurs : un colis a aussi un
 *    destinataire), mais ne renvoient plus qu'à un compte anonyme.
 *
 * Avant : le service appelait des modèles absents de models/index.js
 * (`Notification`, `Paiement`) et des colonnes inexistantes : toute demande
 * de suppression échouait en 500.
 */
class RgpdService {
  static async deleteUserAccount(userId) {
    const utilisateur = await Utilisateur.findByPk(userId);
    if (!utilisateur) {
      return { success: false, message: 'Utilisateur non trouvé' };
    }

    // Le dernier administrateur actif ne peut pas supprimer son compte :
    // personne ne pourrait plus accéder au back-office.
    if (utilisateur.role === 'Admin' && utilisateur.statut === 'actif') {
      const autresAdmins = await Utilisateur.count({
        where: { role: 'Admin', statut: 'actif', id: { [Op.ne]: userId } },
      });
      if (autresAdmins === 0) {
        return { success: false, message: 'Impossible de supprimer le dernier administrateur actif' };
      }
    }

    const motDePasseInutilisable = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);

    await sequelize.transaction(async (t) => {
      await Notifications.destroy({
        where: { [Op.or]: [{ expediteurId: userId }, { recepteurId: userId }] },
        force: true,
        transaction: t,
      });
      await ContactFavori.destroy({ where: { utilisateur_id: userId }, transaction: t });
      await Avis.destroy({ where: { utilisateur_id: userId }, transaction: t });
      await Reclamation.destroy({ where: { utilisateur_id: userId }, transaction: t });
      await RefreshToken.destroy({ where: { utilisateurId: userId }, transaction: t });

      await utilisateur.update({
        nom: 'Compte',
        prenom: 'supprimé',
        // e-mail unique et valide, jamais utilisable pour se connecter
        email: `supprime-${userId}@compte-supprime.invalid`,
        telephone: null,
        adresse: '',
        mot_de_passe: motDePasseInutilisable,
        statut: 'inactif',
        fcm_token: null,
        photoProfil: null,
        resetPasswordToken: null,
        resetPasswordExpires: null,
        otpCode: null,
        otpExpires: null,
        passwordChangedAt: new Date(),
      }, { transaction: t });

      await utilisateur.destroy({ transaction: t }); // soft delete (paranoid)
    });

    logger.info('Compte utilisateur supprimé (RGPD, anonymisation)', { user_id: userId });

    return {
      success: true,
      message: 'Compte supprimé : vos données personnelles ont été effacées définitivement',
    };
  }
}

module.exports = RgpdService;
