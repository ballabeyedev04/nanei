const { Colis, Utilisateur } = require('../../models');
const sequelize = require('../../config/db');
const { Op } = require('sequelize');

class EnvoieColisService {

  // 🔹 Générer référence
  static async genererReferenceColis() {
    const annee = new Date().getFullYear();

    const dernierColis = await Colis.findOne({
      where: {
        reference: { [Op.like]: `COL-${annee}-%` }
      },
      order: [['created_at', 'DESC']],
      attributes: ['reference']
    });

    let compteur = 1;

    if (dernierColis?.reference) {
      const parts = dernierColis.reference.split('-');
      compteur = parseInt(parts[2]) + 1;
    }

    return `COL-${annee}-${String(compteur).padStart(4, '0')}`;
  }

  // 🔹 Créer colis
  static async envoieColis({
    recepteurId,
    poids,
    prix,
    utilisateurConnecte,
    destination
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
        destination
      }, { transaction });

      await transaction.commit();

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
}

module.exports = EnvoieColisService;
