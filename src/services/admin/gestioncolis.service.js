const { Colis, Utilisateur } = require('../../models');

class GestionColisService {

  //liste de tous les colis
  static async listeTousLesColis() {
    try {
      const colis = await Colis.findAll({
        include: [
          {
            model: Utilisateur,
            as: 'expediteur',
            attributes: ['nom', 'prenom', 'email', 'telephone']
          },
          {
            model: Utilisateur,
            as: 'recepteur',
            attributes: ['nom', 'prenom', 'email', 'telephone']
          }
        ],
        order: [['created_at', 'DESC']]
      });

      return {
        success: true,
        message: 'Colis récupérés avec succès',
        colis
      };

    } catch (error) {
      throw new Error('Erreur lors de la récupération des colis');
    }
  }

  // 🔹 Nombre total de colis
  static async nombreColis() {
    try {
      const total = await Colis.count();
      return {
        success: true,
        message: 'Nombre Total des Colis récupérés avec succès',
        nombre_colis: total
      };

    } catch (error) {
      throw new Error('Erreur lors du comptage des colis');
    }
  }

  //liste des colis recupere
  static async listeColisRecuperes() {
    try {
      const colis = await Colis.findAll({
        where: {
          statut: 'recupere'
        },
        include: [
          {
            model: Utilisateur,
            as: 'expediteur',
            attributes: ['nom', 'prenom', 'email', 'telephone']
          },
          {
            model: Utilisateur,
            as: 'recepteur',
            attributes: ['nom', 'prenom', 'email', 'telephone']
          }
        ],
        order: [['created_at', 'DESC']]
      });

      return {
        success: true,
        message: 'Colis récupérés avec succès',
        colis
      };

    } catch (error) {
      throw new Error('Erreur lors de la récupération des colis récupérés');
    }
  }

  //nombre de colis recuperes
  static async nombreColisRecuperes() {
    try {
      const total = await Colis.count({
        where: {
          statut: 'recupere'
        }
      });
      return {
        success: true,
        message: 'Nombre Total des Colis récupérés avec succès',
        nombre_colis: total
      };

    } catch (error) {
      throw new Error('Erreur lors du comptage des colis récupérés');
    }
  }

  //liste des colis en attente
  static async listeColisEnAttente() {
    try {
      const colis = await Colis.findAll({
        where: {
          statut: 'en_attente'
        },
        include: [
          {
            model: Utilisateur,
            as: 'expediteur',
            attributes: ['nom', 'prenom', 'email', 'telephone']
          },
          {
            model: Utilisateur,
            as: 'recepteur',
            attributes: ['nom', 'prenom', 'email', 'telephone']
          }
        ],
        order: [['created_at', 'DESC']]
      });

      return {
        success: true,
        message: 'Colis récupérés avec succès',
        colis
      };

    } catch (error) {
      throw new Error('Erreur lors de la récupération des colis en attente');
    }
  }

  //nombre de colis en attente
  static async nombreColisEnAttente() {
    try {
      const total = await Colis.count({
        where: {
          statut: 'en_attente'
        }
      });
      return {
        success: true,
        message: 'Nombre Total des Colis récupérés avec succès',
        nombre_colis: total
      };

    } catch (error) {
      throw new Error('Erreur lors du comptage des colis en attente');
    }
  }

  //liste des colis livres
  static async listeColisLivres() {
    try {
      const colis = await Colis.findAll({
        where: {
          statut: 'livre'
        },
        include: [
          {
            model: Utilisateur,
            as: 'expediteur',
            attributes: ['nom', 'prenom', 'email', 'telephone']
          },
          {
            model: Utilisateur,
            as: 'recepteur',
            attributes: ['nom', 'prenom', 'email', 'telephone']
          }
        ],
        order: [['created_at', 'DESC']]
      });

      return {
        success: true,
        message: 'Colis récupérés avec succès',
        colis
      };

    } catch (error) {
      throw new Error('Erreur lors de la récupération des colis livrés');
    }
  }

  //nombre de colis livres
  static async nombreColisLivres() {
    try {
      const total = await Colis.count({
        where: {
          statut: 'livre'
        }
      });
      return {
        success: true,
        message: 'Nombre Total des Colis récupérés avec succès',
        nombre_colis: total
      };

    } catch (error) {
      throw new Error('Erreur lors du comptage des colis livrés');
    }
  }

  //rechercher un colis par numero
  static async rechercherColis(reference) {
    try {
      const colis = await Colis.findOne({
        where: {
          reference
        },
        include: [
          {
            model: Utilisateur,
            as: 'expediteur',
            attributes: ['nom', 'prenom', 'email', 'telephone']
          },
          {
            model: Utilisateur,
            as: 'recepteur',
            attributes: ['nom', 'prenom', 'email', 'telephone']
          }
        ],
      });

      return {
        success: true,
        message: 'Colis récupérés avec succès',
        colis
      };

    } catch (error) {
      throw new Error('Erreur lors de la recherche du colis');
    }
  }

  // ===================== EN ATTENTE =====================
  static async changerEnAttente(id) {
    try {
      const colis = await Colis.findByPk(id);

      if (!colis) {
        return { success: false, message: "Colis introuvable" };
      }

      colis.statut = "en_attente";
      await colis.save();

      return {
        success: true,
        message: "Colis mis en attente avec succès",
        colis
      };

    } catch (error) {
      throw error;
    }
  }

  // ===================== LIVRÉ =====================
  static async changerEnLivre(id) {
    try {
      const colis = await Colis.findByPk(id);

      if (!colis) {
        return { success: false, message: "Colis introuvable" };
      }

      colis.statut = "livre";
      await colis.save();

      return {
        success: true,
        message: "Colis marqué comme livré",
        colis
      };

    } catch (error) {
      throw error;
    }
  }

  // ===================== RÉCUPÉRÉ =====================
  static async changerEnRecupere(id) {
    try {
      const colis = await Colis.findByPk(id);

      if (!colis) {
        return { success: false, message: "Colis introuvable" };
      }

      colis.statut = "recupere";
      await colis.save();

      return {
        success: true,
        message: "Colis marqué comme récupéré",
        colis
      };

    } catch (error) {
      throw error;
    }
  }

}

module.exports = GestionColisService;
