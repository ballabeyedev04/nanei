const { Op } = require('sequelize');
const { paginer, motifRecherche } = require('../../utils/pagination');
const Utilisateur = require('../../models/utilisateur.model');

class GestionUtilisateurService {

  // 🔹 Lister utilisateurs Particuliers
  // Query : page, limit (pagination facultative), q (nom, prénom, e-mail, téléphone)
  static async listeUtilisateur(query = {}) {
    try {
      const motif = motifRecherche(query.q);
      return await paginer(Utilisateur, {
        where: {
          role: 'Particulier',
          // Les comptes destinataires automatiques ne sont pas des clients
          // inscrits : ils sont exclus des listes et des compteurs.
          compteAuto: false,
          ...(motif ? { [Op.or]: [
            { nom: { [Op.iLike]: motif } },
            { prenom: { [Op.iLike]: motif } },
            { email: { [Op.iLike]: motif } },
            { telephone: { [Op.iLike]: motif } },
          ] } : {}),
        },
        attributes: { exclude: Utilisateur.CHAMPS_PRIVES },
        order: [['created_at', 'DESC']]
      }, query);

    } catch (error) {
      throw new Error('Erreur lors de la récupération des utilisateurs', { cause: error });
    }
  }


  // 🔹 Activer utilisateur
  static async activerUtilisateur({ id }) {
    try {
      const utilisateur = await Utilisateur.findByPk(id);

      // Route réservée aux clients : un compte Admin se gère par
      // /admin/activer-admin (garde-fous propres aux administrateurs).
      if (!utilisateur || utilisateur.role === 'Admin') {
        throw new Error('Utilisateur non trouvé');
      }

      // Compte destinataire jamais revendiqué : l'activer bloquerait
      // l'inscription de la personne (« email déjà utilisé ») sans lui donner
      // de mot de passe. Elle doit s'inscrire elle-même.
      if (utilisateur.compteAuto) {
        throw new Error("Ce compte destinataire n'a pas encore été créé par la personne : elle doit s'inscrire dans l'application");
      }

      if (utilisateur.statut === 'actif') {
        throw new Error('Utilisateur déjà actif');
      }

      utilisateur.statut = 'actif';
      await utilisateur.save();

      return utilisateur.toJSON();

    } catch (error) {
      throw new Error(error.message, { cause: error });
    }
  }

  // 🔹 Désactiver utilisateur
  static async desactiverUtilisateur({ id }) {
    try {
      const utilisateur = await Utilisateur.findByPk(id);

      // Route réservée aux clients : désactiver un admin passe par
      // /admin/desactiver-admin (interdit sur soi-même et sur le dernier admin).
      if (!utilisateur || utilisateur.role === 'Admin') {
        throw new Error('Utilisateur non trouvé');
      }

      if (utilisateur.statut === 'inactif') {
        throw new Error('Utilisateur déjà inactif');
      }

      utilisateur.statut = 'inactif';
      await utilisateur.save();

      return utilisateur.toJSON();

    } catch (error) {
      throw new Error(error.message, { cause: error });
    }
  }

  // 🔹 Nombre d'utilisateurs particuliers
  static async nombreUtilisateursParticuliers() {
    try {
      const total = await Utilisateur.count({
        where: {
          role: 'Particulier',
          // Les comptes destinataires automatiques ne sont pas des clients
          // inscrits : ils sont exclus des listes et des compteurs.
          compteAuto: false
        }
      });

      return total;

    } catch (error) {
      throw new Error('Erreur lors du comptage des utilisateurs', { cause: error });
    }
  }

  // 🔹 Rechercher utilisateur
  static async rechercherUtilisateur({ nom, prenom, email }) {
    try {
      // Insensible à la casse, % et _ saisis pris littéralement (avant : LIKE
      // brut, « dupont » ne trouvait pas « Dupont »).
      const where = { role: 'Particulier',
          // Les comptes destinataires automatiques ne sont pas des clients
          // inscrits : ils sont exclus des listes et des compteurs.
          compteAuto: false };

      if (motifRecherche(nom)) where.nom = { [Op.iLike]: motifRecherche(nom) };
      if (motifRecherche(prenom)) where.prenom = { [Op.iLike]: motifRecherche(prenom) };
      if (motifRecherche(email)) where.email = { [Op.iLike]: motifRecherche(email) };

      const utilisateurs = await Utilisateur.findAll({
        where,
        attributes: { exclude: Utilisateur.CHAMPS_PRIVES },
        order: [['created_at', 'DESC']]
      });

      return utilisateurs;

    } catch (error) {
      throw new Error('Erreur lors de la recherche des utilisateurs', { cause: error });
    }
  }

}


module.exports = GestionUtilisateurService;
