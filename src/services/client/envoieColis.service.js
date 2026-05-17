const { Colis, Utilisateur, Notifications } = require('../../models');
const sequelize = require('../../config/db');
const { Op } = require('sequelize');
const crypto = require('crypto');
const { sendSMS } = require('../sms.service');

class EnvoieColisService {

  // 🔹 Générer référence
  static async genererReferenceColis() {

    let reference;
    let existe = true;

    while (existe) {

      const annee = new Date().getFullYear();
      const random = crypto.randomBytes(3).toString('hex').toUpperCase();
      const time = Date.now().toString().slice(-4);

      reference = `COL-${annee}-${random}-${time}`;

      const colis = await Colis.findOne({ where: { reference } });

      if (!colis) {
        existe = false;
      }
    }

    return reference;
  }

  // 🔹 Créer colis
  static async envoieColis({
    recepteurId,
    poids,
    prix,
    utilisateurConnecte,
    destination,
    description,
    type_colis
  }) {

    const transaction = await sequelize.transaction();

    try {
      // ✅ vérifier recepteur
      const recepteur = await Utilisateur.findByPk(recepteurId);
      if (!recepteur) {
        throw new Error('Recepteur non trouvé');
      }

      // ✅ générer référence
      const reference = await this.genererReferenceColis();

      // ✅ créer colis
      const colis = await Colis.create({
        reference,
        recepteurId,
        expediteurId: utilisateurConnecte.id,
        poids,
        prix,
        destination,
        description: description || null,
        type_colis
      }, { transaction });

      await Notifications.create({
        expediteurId: utilisateurConnecte.id,
        recepteurId: recepteurId,
        colisId: colis.id
      }, { transaction });

      await transaction.commit();

      // ✅ Envoi du SMS de notification au destinataire via l'API Orange (non-bloquant)
      if (recepteur.telephone) {
        const messageText = `Bonjour ${recepteur.prenom} ${recepteur.nom}, vous allez recevoir le colis reference : ${colis.reference} chez Franco Mali Ship. Merci de votre confiance !`;
        sendSMS(recepteur.telephone, messageText).catch(err => {
          console.error("⚠️ Échec d'envoi du SMS de notification Orange :", err);
        });
      }

      return {
        success: true,
        message: 'Colis créé avec succès',
        data: colis
      };

    } catch (error) {
      await transaction.rollback();
      console.error('❌ Erreur envoieColis:', error);

      return {
        success: false,
        message: error.message
      };
    }
  }

  // 🔹 Rechercher un client par nom, prénom ou email
  static async rechercherClient(searchTerm) {
    try {
      // Si la recherche est vide, on peut retourner une liste vide
      if (!searchTerm || searchTerm.trim() === '') {
        return {
          success: true,
          data: []
        };
      }

      const clients = await Utilisateur.findAll({
        where: {
          [Op.or]: [
            { nom: { [Op.like]: `%${searchTerm}%` } },
            { prenom: { [Op.like]: `%${searchTerm}%` } },
            { email: { [Op.like]: `%${searchTerm}%` } }
          ]
        },
        attributes: ['id', 'nom', 'prenom', 'email'], // on limite aux champs utiles
        limit: 20 // limite raisonnable
      });

      return {
        success: true,
        data: clients
      };
    } catch (error) {
      console.error('❌ Erreur recherche client:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  // 🔹 Récupérer les colis envoyés par un utilisateur
  static async getColisEnvoyes(utilisateurId) {
    try {
      const colisEnvoyes = await Colis.findAll({
        where: { expediteurId: utilisateurId },
        include: [
          {
            model: Utilisateur,
            as: 'recepteur',
            attributes: ['id', 'nom', 'prenom', 'email']
          },
          {
            model: Utilisateur,
            as: 'expediteur',
            attributes: ['id', 'nom', 'prenom', 'email']
          },
        ],
        order: [['created_at', 'DESC']]
      });

      return {
        success: true,
        data: colisEnvoyes
      };
    } catch (error) {
      console.error('❌ Erreur getColisEnvoyes:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  // 🔹 Récupérer les colis reçus par un utilisateur
  static async getColisRecus(utilisateurId) {
    try {
      const colisRecus = await Colis.findAll({
        where: { recepteurId: utilisateurId },
        include: [
          {
            model: Utilisateur,
            as: 'expediteur',
            attributes: ['id', 'nom', 'prenom', 'email']
          },
          {
            model: Utilisateur,
            as: 'recepteur',
            attributes: ['id', 'nom', 'prenom', 'email']
          },
        ],
        order: [['created_at', 'DESC']]
      });

      return {
        success: true,
        data: colisRecus
      };
    } catch (error) {
      console.error('❌ Erreur getColisRecus:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  // 🔹 Statistiques colis utilisateur
  static async getStatistiquesColis(utilisateurId) {
    try {

      const colisEnvoyes = await Colis.count({
        where: { expediteurId: utilisateurId }
      });

      const colisRecus = await Colis.count({
        where: { recepteurId: utilisateurId }
      });

      return {
        success: true,
        data: {
          colisEnvoyes,
          colisRecus,
          total: colisEnvoyes + colisRecus
        }
      };

    } catch (error) {
      console.error('❌ Erreur getStatistiquesColis:', error);

      return {
        success: false,
        message: error.message
      };
    }
  }

  // 🔹 Récupérer les notifications reçues par un utilisateur
  static async getNotifications(utilisateurId) {
    try {
      const notificationsRecus = await Notifications.findAll({
        where: { recepteurId: utilisateurId },
        include: [
          {
            model: Colis,
            as: 'colis',
            attributes: ['id', 'reference', 'type_colis', 'description', 'statut', 'created_at']
          },
          {
            model: Utilisateur,
            as: 'expediteur',
            attributes: ['id', 'nom', 'prenom', 'email']
          }
        ],
        order: [['created_at', 'DESC']],
        limit: 50
      });

      return {
        success: true,
        data: notificationsRecus
      };
    } catch (error) {
      console.error('❌ Erreur getNotifications:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  static async marquerNotificationCommeLue(notificationId) {
    try {
      const notif = await Notifications.findByPk(notificationId);
      if (!notif) {
        throw new Error('Notification introuvable');
      }

      notif.statut = 'lu';
      await notif.save();

      return {
        success: true,
        data: notif
      };

    } catch (error) {
      console.error('❌ Erreur marquerNotificationCommeLue:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

}

module.exports = EnvoieColisService;
