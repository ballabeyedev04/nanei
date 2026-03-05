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
}

module.exports = EnvoieColisService;
