const Utilisateur = require('../../models/utilisateur.model');

class GestionUtilisateurService {

    // 🔹 Lister utilisateurs Particuliers
    static async listeUtilisateur() {
    try {
        const utilisateurs = await Utilisateur.findAll({
        where: {
            role: 'Particulier'
        },
        attributes: { exclude: ['mot_de_passe'] },
        order: [['created_at', 'DESC']]
        });

        return utilisateurs;

    } catch (error) {
        throw new Error('Erreur lors de la récupération des utilisateurs');
    }
    }


  // 🔹 Activer utilisateur
  static async activerUtilisateur({ id }) {
    try {
      const utilisateur = await Utilisateur.findByPk(id);

      if (!utilisateur) {
        throw new Error('Utilisateur non trouvé');
      }

      if (utilisateur.statut === 'actif') {
        throw new Error('Utilisateur déjà actif');
      }

      utilisateur.statut = 'actif';
      await utilisateur.save();

      const { mot_de_passe, ...userSafe } = utilisateur.toJSON();
      return userSafe;

    } catch (error) {
      throw new Error(error.message);
    }
  }

  // 🔹 Désactiver utilisateur
  static async desactiverUtilisateur({ id }) {
    try {
      const utilisateur = await Utilisateur.findByPk(id);

      if (!utilisateur) {
        throw new Error('Utilisateur non trouvé');
      }

      if (utilisateur.statut === 'inactif') {
        throw new Error('Utilisateur déjà inactif');
      }

      utilisateur.statut = 'inactif';
      await utilisateur.save();

      const { mot_de_passe, ...userSafe } = utilisateur.toJSON();
      return userSafe;

    } catch (error) {
      throw new Error(error.message);
    }
  }

  // 🔹 Nombre d’utilisateurs particuliers
    static async nombreUtilisateursParticuliers() {
    try {
        const total = await Utilisateur.count({
        where: {
            role: 'Particulier'
        }
        });

        return total;

    } catch (error) {
        throw new Error('Erreur lors du comptage des utilisateurs');
    }
    }

}


module.exports = GestionUtilisateurService;
