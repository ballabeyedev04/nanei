const Colis = require('../../models/colis.model');

class GestionColisService {

  // 🔹 Liste des colis envoyés (déjà expédiés)
  static async listeColisEnvoyes() {
    try {
      const colis = await Colis.findAll({
        where: {
          statut: ['recupere','livre']
        },
        order: [['created_at', 'DESC']]
      });

      return colis;

    } catch (error) {
      throw new Error('Erreur lors de la récupération des colis envoyés');
    }
  }

  // 🔹 Liste des colis en attente
  static async listeColisEnAttente() {
    try {
      const colis = await Colis.findAll({
        where: {
          statut: 'en_attente'
        },
        order: [['created_at', 'DESC']]
      });

      return colis;

    } catch (error) {
      throw new Error('Erreur lors de la récupération des colis en attente');
    }
  }

  // 🔹 Nombre total de colis
  static async nombreColis() {
    try {
      const total = await Colis.count();
      return total;

    } catch (error) {
      throw new Error('Erreur lors du comptage des colis');
    }
  }

  // 🔹 Nombre colis par statut (BONUS très utile)
  static async nombreParStatut() {
    try {
      const result = await Colis.findAll({
        attributes: [
          'statut',
          [Colis.sequelize.fn('COUNT', Colis.sequelize.col('statut')), 'total']
        ],
        group: ['statut']
      });

      return result;

    } catch (error) {
      throw new Error('Erreur lors du comptage par statut');
    }
  }

}

module.exports = GestionColisService;
