const { Colis, Utilisateur, Notifications, ContactFavori } = require('../../models');
const Paiement = require('../../models/paiement.model');
const sequelize = require('../../config/db');
const { Op } = require('sequelize');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { bcryptConfig } = require('../../config/security');
const logger = require('../../config/logger');
const { sendSMS } = require('../twilio.service');

class EnvoieColisService {

  // 🔹 Résoudre un destinataire saisi manuellement par l'expéditeur (le
  // destinataire n'a pas encore de compte). On réutilise un compte existant
  // s'il correspond (dédup par email réel puis par téléphone), sinon on crée
  // un compte "léger" (statut inactif) qui sera revendiqué automatiquement le
  // jour où la personne s'inscrit (voir AuthService.register).
  //
  // Retourne l'instance Utilisateur à utiliser comme récepteur.
  static async resoudreOuCreerRecepteur({ destinataireManuel, transaction }) {
    const prenom = (destinataireManuel?.prenom || '').trim();
    const nom = (destinataireManuel?.nom || '').trim();
    const telephone = (destinataireManuel?.telephone || '').trim();
    const emailSaisi = (destinataireManuel?.email || '').trim().toLowerCase();
    const ville = (destinataireManuel?.ville || '').trim();

    if (!prenom || !nom) {
      throw new Error('Le prénom et le nom du destinataire sont obligatoires');
    }
    if (!telephone) {
      throw new Error('Le téléphone du destinataire est obligatoire');
    }

    // 1) Dédup par email réel (si fourni)
    let recepteur = null;
    if (emailSaisi) {
      recepteur = await Utilisateur.findOne({ where: { email: emailSaisi }, transaction });
    }

    // 2) Dédup par téléphone
    if (!recepteur) {
      recepteur = await Utilisateur.findOne({ where: { telephone }, transaction });
    }

    if (recepteur) {
      if (recepteur.role === 'Admin') {
        throw new Error("Ce contact correspond à un compte non autorisé comme destinataire");
      }
      return recepteur;
    }

    // 3) Créer un compte destinataire léger
    const motDePasse = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), bcryptConfig.saltRounds);
    const email = emailSaisi || `no-email-${crypto.randomUUID()}@nanei.local`;

    recepteur = await Utilisateur.create({
      nom,
      prenom,
      email,
      mot_de_passe: motDePasse,
      adresse: ville || '—',
      telephone,
      role: 'Particulier',
      statut: 'inactif',
    }, { transaction });

    return recepteur;
  }

  // 🔹 Enregistrer / mettre à jour le destinataire dans les contacts favoris
  // de l'expéditeur (dédup sur le téléphone) pour réutilisation ultérieure.
  // Non bloquant : une erreur ici ne doit pas faire échouer l'envoi.
  static async enregistrerContactFavori({ expediteurId, destinataireManuel, transaction }) {
    try {
      const telephone = (destinataireManuel?.telephone || '').trim();
      if (!telephone) return;

      const existant = await ContactFavori.findOne({
        where: { utilisateur_id: expediteurId, telephone },
        transaction,
      });
      if (existant) return;

      await ContactFavori.create({
        utilisateur_id: expediteurId,
        nom: (destinataireManuel.nom || '').trim(),
        prenom: (destinataireManuel.prenom || '').trim() || null,
        email: (destinataireManuel.email || '').trim().toLowerCase() || null,
        telephone,
        ville: (destinataireManuel.ville || '').trim() || null,
        pays_id: destinataireManuel.paysId || null,
      }, { transaction });
    } catch (error) {
      logger.warn('Contact favori non enregistré', { error: error.message });
    }
  }

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
    destinataireManuel,
    poids,
    prix,
    utilisateurConnecte,
    destination,
    description,
    type_colis
  }) {

    const transaction = await sequelize.transaction();

    try {
      // ✅ Résoudre le récepteur : soit un compte existant sélectionné dans la
      // recherche (recepteurId), soit un destinataire saisi manuellement
      // (destinataireManuel) — dans ce cas on réutilise/crée un compte léger.
      let recepteur;
      if (destinataireManuel) {
        recepteur = await this.resoudreOuCreerRecepteur({ destinataireManuel, transaction });
      } else {
        recepteur = await Utilisateur.findByPk(recepteurId, { transaction });
        if (!recepteur) {
          throw new Error('Recepteur non trouvé');
        }
      }
      const recepteurIdFinal = recepteur.id;

      // ✅ générer référence
      const reference = await this.genererReferenceColis();

      // ✅ créer colis
      const colis = await Colis.create({
        reference,
        recepteurId: recepteurIdFinal,
        expediteurId: utilisateurConnecte.id,
        poids,
        prix,
        destination,
        description: description || null,
        type_colis
      }, { transaction });

      await Notifications.create({
        expediteurId: utilisateurConnecte.id,
        recepteurId: recepteurIdFinal,
        colisId: colis.id
      }, { transaction });

      // Créer automatiquement l'enregistrement de paiement
      await Paiement.create({
        colisId:   colis.id,
        payeurId:  utilisateurConnecte.id,
        prixTotal: prix,
        statut:    'en_attente',
      }, { transaction });

      // Mémoriser le destinataire manuel dans les contacts favoris de l'expéditeur
      if (destinataireManuel) {
        await this.enregistrerContactFavori({
          expediteurId: utilisateurConnecte.id,
          destinataireManuel,
          transaction,
        });
      }

      await transaction.commit();

      // ✅ Envoi du SMS de notification au destinataire via l'API Twilio (non-bloquant)

      if (recepteur.telephone) {
  logger.debug('Début envoi SMS notification');
          const messageText = `Bonjour ${recepteur.prenom} ${recepteur.nom}, vous allez recevoir le colis reference : ${colis.reference} chez Franco Mali Ship. Merci de votre confiance !`;


  sendSMS(recepteur.telephone, messageText)
    .then(res => {
      logger.debug('SMS envoyé', { success: res?.success });
    })
    .catch(err => {
      logger.warn('Erreur SMS notification', { error: err.message });
    });

  logger.debug('Fin lancement SMS');
}

      return {
        success: true,
        message: 'Colis créé avec succès',
        data: colis
      };

    } catch (error) {
      await transaction.rollback();
      logger.error('Erreur envoieColis', { error: error.message, stack: error.stack });

      return {
        success: false,
        message: error.message
      };
    }
  }

  // 🔹 Créer plusieurs colis en une seule commande groupée (regroupement) —
  // même logique que envoieColis() rejouée pour chaque élément du lot, dans
  // UNE SEULE transaction (tout ou rien) et avec un lot_id commun généré une
  // fois pour toute la commande.
  static async envoieColisLot({ items, utilisateurConnecte }) {
    if (!Array.isArray(items) || items.length === 0) {
      return { success: false, message: 'Aucun colis fourni' };
    }
    if (items.length > 20) {
      return { success: false, message: 'Un lot ne peut pas contenir plus de 20 colis' };
    }

    const transaction = await sequelize.transaction();
    const lotId = crypto.randomUUID();

    try {
      const colisCrees = [];

      for (const item of items) {
        const { recepteurId, destinataireManuel, poids, prix, destination, description, type_colis } = item;

        if ((!recepteurId && !destinataireManuel) || !poids || !prix || !destination) {
          throw new Error('Un des colis du lot est incomplet (destinataire, poids, prix ou destination manquant)');
        }

        let recepteur;
        if (destinataireManuel) {
          recepteur = await this.resoudreOuCreerRecepteur({ destinataireManuel, transaction });
        } else {
          recepteur = await Utilisateur.findByPk(recepteurId, { transaction });
          if (!recepteur) {
            throw new Error('Récepteur non trouvé pour un des colis du lot');
          }
        }
        const recepteurIdFinal = recepteur.id;

        const reference = await this.genererReferenceColis();

        const colis = await Colis.create({
          reference,
          recepteurId: recepteurIdFinal,
          expediteurId: utilisateurConnecte.id,
          poids,
          prix,
          destination,
          description: description || null,
          type_colis,
          lot_id: lotId,
        }, { transaction });

        await Notifications.create({
          expediteurId: utilisateurConnecte.id,
          recepteurId: recepteurIdFinal,
          colisId: colis.id,
        }, { transaction });

        await Paiement.create({
          colisId:   colis.id,
          payeurId:  utilisateurConnecte.id,
          prixTotal: prix,
          statut:    'en_attente',
        }, { transaction });

        if (destinataireManuel) {
          await this.enregistrerContactFavori({
            expediteurId: utilisateurConnecte.id,
            destinataireManuel,
            transaction,
          });
        }

        colisCrees.push({ colis, recepteur });
      }

      await transaction.commit();

      // SMS de notification par colis (non-bloquant, un envoi par destinataire)
      for (const { colis, recepteur } of colisCrees) {
        if (recepteur.telephone) {
          const messageText = `Bonjour ${recepteur.prenom} ${recepteur.nom}, vous allez recevoir le colis reference : ${colis.reference} chez Franco Mali Ship. Merci de votre confiance !`;
          sendSMS(recepteur.telephone, messageText)
            .then(res => logger.debug('SMS envoyé (lot)', { success: res?.success }))
            .catch(err => logger.warn('Erreur SMS notification (lot)', { error: err.message }));
        }
      }

      return {
        success: true,
        message: `${colisCrees.length} colis créés avec succès`,
        data: { lotId, colis: colisCrees.map(c => c.colis) },
      };

    } catch (error) {
      await transaction.rollback();
      logger.error('Erreur envoieColisLot', { error: error.message, stack: error.stack });
      return { success: false, message: error.message };
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
          // Whitelist explicite : seuls les comptes Particulier sont
          // sélectionnables comme destinataire. Ne jamais exposer les
          // comptes Admin (email/identité) à la recherche client.
          role: 'Particulier',
          // Exclure les comptes "légers" créés automatiquement pour un
          // destinataire sans compte : ils ne sont pas censés être
          // découvrables par d'autres expéditeurs.
          statut: 'actif',
          [Op.or]: [
            { nom: { [Op.like]: `%${searchTerm}%` } },
            { prenom: { [Op.like]: `%${searchTerm}%` } },
            { email: { [Op.like]: `%${searchTerm}%` } }
          ]
        },
        attributes: ['id', 'nom', 'prenom', 'email', 'telephone'], // on limite aux champs utiles
        limit: 20 // limite raisonnable
      });

      return {
        success: true,
        data: clients
      };
    } catch (error) {
      logger.error('Erreur rechercherClient', { error: error.message, stack: error.stack });
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
            attributes: ['id', 'nom', 'prenom', 'email', 'telephone']
          },
          {
            model: Utilisateur,
            as: 'expediteur',
            attributes: ['id', 'nom', 'prenom', 'email', 'telephone']
          },
        ],
        order: [['created_at', 'DESC']]
      });

      return {
        success: true,
        data: colisEnvoyes
      };
    } catch (error) {
      logger.error('Erreur getColisEnvoyes', { error: error.message, stack: error.stack });
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
            attributes: ['id', 'nom', 'prenom', 'email', 'telephone']
          },
          {
            model: Utilisateur,
            as: 'recepteur',
            attributes: ['id', 'nom', 'prenom', 'email', 'telephone']
          },
        ],
        order: [['created_at', 'DESC']]
      });

      return {
        success: true,
        data: colisRecus
      };
    } catch (error) {
      logger.error('Erreur getColisRecus', { error: error.message, stack: error.stack });
      return {
        success: false,
        message: error.message
      };
    }
  }

  // 🔹 Rechercher un colis par référence (scan QR code de l'étiquette) —
  // uniquement si l'utilisateur connecté est l'expéditeur ou le
  // destinataire du colis, jamais un tiers.
  static async rechercherColisParReference(reference, utilisateurId) {
    try {
      const colis = await Colis.findOne({
        where: { reference },
        include: [
          { model: Utilisateur, as: 'expediteur', attributes: ['id', 'nom', 'prenom', 'email', 'telephone'] },
          { model: Utilisateur, as: 'recepteur',  attributes: ['id', 'nom', 'prenom', 'email', 'telephone'] },
        ],
      });

      if (!colis) {
        return { success: false, message: 'Colis introuvable' };
      }

      if (colis.expediteurId !== utilisateurId && colis.recepteurId !== utilisateurId) {
        return { success: false, message: 'Ce colis ne vous appartient pas' };
      }

      return { success: true, data: colis };
    } catch (error) {
      logger.error('Erreur rechercherColisParReference', { error: error.message, stack: error.stack });
      return { success: false, message: error.message };
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
      logger.error('Erreur getStatistiquesColis', { error: error.message, stack: error.stack });

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
            attributes: ['id', 'nom', 'prenom', 'email', 'telephone']
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
      logger.error('Erreur getNotifications', { error: error.message, stack: error.stack });
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
      logger.error('Erreur marquerNotificationCommeLue', { error: error.message, stack: error.stack });
      return {
        success: false,
        message: error.message
      };
    }
  }

}

module.exports = EnvoieColisService;
