const { Colis, Utilisateur, Notifications, ContactFavori } = require('../../models');
const { paginer, lirePagination, metaPagination } = require('../../utils/pagination');
const Paiement = require('../../models/paiement.model');
const sequelize = require('../../config/db');
const { fn, col } = require('sequelize');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { bcryptConfig } = require('../../config/security');
const logger = require('../../config/logger');
const { sendSMS } = require('../twilio.service');
const PricingCalculatorService = require('../pricingCalculator.service');
const { normaliserTypeTransport } = require('../../utils/typeTransport');

/** « aminata.diallo@gmail.com » → « am***@gmail.com » */
function masquerEmail(email) {
  const [local, domaine] = String(email || '').split('@');
  if (!domaine) return '';
  return `${local.slice(0, 2)}***@${domaine}`;
}

/** « +22376001234 » → « +223 ** ** 12 34 » (indicatif et 4 derniers chiffres) */
function masquerTelephone(tel) {
  const t = String(tel || '').replace(/\s/g, '');
  if (t.length < 6) return '';
  const fin = t.slice(-4);
  const indicatif = t.startsWith('+') ? t.slice(0, 4) : '';
  return `${indicatif} ** ** ${fin.slice(0, 2)} ${fin.slice(2)}`.trim();
}

const STATUTS_COLIS = ['en_attente', 'recupere', 'livre'];

/** Filtre facultatif ?statut= des listes de colis du client (appliqué AVANT la pagination). */
function filtreStatutColis(statut) {
  if (statut === undefined || statut === '' || statut === 'tous') return { where: {} };
  if (!STATUTS_COLIS.includes(statut)) return { erreur: `Statut invalide (${STATUTS_COLIS.join(', ')})` };
  return { where: { statut } };
}

/** Nombre de colis par statut, sur TOUTES les pages (compteurs des écrans mobiles). */
async function compterColisParStatut(where) {
  const lignes = await Colis.findAll({ where, attributes: ['statut', [fn('COUNT', col('id')), 'nombre']], group: ['statut'], raw: true });
  const resultat = { en_attente: 0, recupere: 0, livre: 0, total: 0 };
  for (const l of lignes) {
    const n = Number(l.nombre) || 0;
    resultat[l.statut] = n;
    resultat.total += n;
  }
  return resultat;
}

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
      compteAuto: true, // revendiquable à l'inscription (voir auth.service)
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

  // 🔹 Prix d'un colis — calculé CÔTÉ SERVEUR à partir de la grille
  // tarifaire (jamais le prix envoyé par le client, qui pourrait être
  // falsifié). Le mobile (>= 1.0.2+13) envoie countryId + shippingType +
  // needsPickup + needsDelivery.
  //
  // Anciennes versions de l'app (qui n'envoient que `prix`) : tolérées tant
  // que PRIX_SERVEUR_OBLIGATOIRE !== 'true', avec un avertissement dans les
  // logs. Passer la variable à 'true' une fois les anciennes versions
  // retirées du store.
  static async resoudrePrix({ countryId, shippingType, needsPickup, needsDelivery, poids, prix }) {
    if (countryId && shippingType) {
      const result = await PricingCalculatorService.calculateTotalPrice(
        countryId,
        poids,
        shippingType,
        needsPickup === true || needsPickup === 'true',
        needsDelivery === true || needsDelivery === 'true'
      );
      if (!result.success) {
        throw new Error(result.message);
      }
      return { prix: result.data.total, destination: result.data.breakdown.country };
    }

    if (process.env.PRIX_SERVEUR_OBLIGATOIRE === 'true') {
      throw new Error("Version de l'application obsolète : mettez à jour l'application pour envoyer un colis");
    }
    const prixClient = Number(prix);
    if (!Number.isFinite(prixClient) || prixClient <= 0) {
      throw new Error('Prix invalide');
    }
    logger.warn("Prix colis fourni par le client (ancienne version de l'app, sans countryId/shippingType)", { prix: prixClient });
    return { prix: prixClient, destination: null };
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
    type_colis,
    countryId,
    shippingType,
    needsPickup,
    needsDelivery
  }) {

    const transaction = await sequelize.transaction();

    try {
      if (!destination && !countryId) {
        throw new Error('La destination est obligatoire');
      }
      const tarif = await this.resoudrePrix({ countryId, shippingType, needsPickup, needsDelivery, poids, prix });
      prix = tarif.prix;
      destination = tarif.destination || destination;

      // ✅ Résoudre le récepteur : soit un compte existant sélectionné dans la
      // recherche (recepteurId), soit un destinataire saisi manuellement
      // (destinataireManuel) — dans ce cas on réutilise/crée un compte léger.
      let recepteur;
      if (destinataireManuel) {
        recepteur = await this.resoudreOuCreerRecepteur({ destinataireManuel, transaction });
      } else {
        recepteur = await Utilisateur.findByPk(recepteurId, { transaction });
        // Un compte administrateur n'est jamais destinataire (même règle que
        // la saisie manuelle et la recherche de client).
        if (!recepteur || recepteur.role === 'Admin') {
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
        type_colis,
        type_transport: normaliserTypeTransport(shippingType),
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
        const { recepteurId, destinataireManuel, poids, description, type_colis,
                countryId, shippingType, needsPickup, needsDelivery } = item;

        if ((!recepteurId && !destinataireManuel) || !poids || (!item.destination && !countryId)) {
          throw new Error('Un des colis du lot est incomplet (destinataire, poids ou destination manquant)');
        }

        const tarif = await this.resoudrePrix({
          countryId, shippingType, needsPickup, needsDelivery, poids, prix: item.prix,
        });
        const prix = tarif.prix;
        const destination = tarif.destination || item.destination;

        let recepteur;
        if (destinataireManuel) {
          recepteur = await this.resoudreOuCreerRecepteur({ destinataireManuel, transaction });
        } else {
          recepteur = await Utilisateur.findByPk(recepteurId, { transaction });
          if (!recepteur || recepteur.role === 'Admin') {
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
          type_transport: normaliserTypeTransport(shippingType),
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
  // 🔹 Recherche d'un destinataire inscrit, par e-mail OU téléphone EXACT.
  //
  // Avant : recherche partielle sur nom / prénom / e-mail (« a » renvoyait 20
  // comptes avec leur e-mail et leur téléphone complets) — n'importe quel
  // client connecté pouvait parcourir l'annuaire. Maintenant :
  //  - il faut connaître l'e-mail complet ou le numéro (mêmes règles que la
  //    connexion : avec ou sans indicatif) ;
  //  - au plus UN compte est renvoyé, client actif seulement ;
  //  - e-mail et téléphone sont MASQUÉS (affichage de confirmation) ; l'envoi
  //    n'utilise que l'`id`.
  static async rechercherClient(searchTerm, demandeurId) {
    try {
      const saisie = String(searchTerm || '').trim();
      if (saisie.length < 5) {
        return { success: true, data: [] };
      }

      const AuthService = require('../auth.service');
      const estEmail = /^\S+@\S+\.\S+$/.test(saisie);
      // Un numéro doit compter au moins 7 chiffres (même règle que la
      // connexion par téléphone) : en dessous, aucune recherche.
      if (!estEmail && saisie.replace(/\D/g, '').length < 7) {
        return { success: true, data: [] };
      }
      const trouve = estEmail
        ? await Utilisateur.findOne({ where: { email: saisie.toLowerCase() } })
        : await AuthService.trouverParTelephone(saisie);

      if (!trouve || trouve.role !== 'Particulier' || trouve.statut !== 'actif' || trouve.compteAuto
          || String(trouve.id) === String(demandeurId)) {
        return { success: true, data: [] };
      }

      return {
        success: true,
        data: [{
          id: trouve.id,
          nom: trouve.nom,
          prenom: trouve.prenom,
          email: masquerEmail(trouve.email),
          telephone: masquerTelephone(trouve.telephone),
        }],
      };
    } catch (error) {
      logger.error('Erreur rechercherClient', { error: error.message, stack: error.stack });
      return {
        success: false,
        message: 'Recherche impossible pour le moment'
      };
    }
  }

  // 🔹 Récupérer les colis envoyés par un utilisateur
  // Pagination facultative (?page=&limit=) : sans paramètre, liste complète.
  static async getColisEnvoyes(utilisateurId, query = {}) {
    try {
      const filtre = filtreStatutColis(query.statut);
      if (filtre.erreur) return { success: false, message: filtre.erreur };
      const { lignes: colisEnvoyes, pagination } = await paginer(Colis, {
        where: { expediteurId: utilisateurId, ...filtre.where },
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
      }, query);

      return {
        success: true,
        data: colisEnvoyes,
        pagination,
        par_statut: await compterColisParStatut({ expediteurId: utilisateurId })
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
  // Pagination facultative (?page=&limit=) : sans paramètre, liste complète.
  static async getColisRecus(utilisateurId, query = {}) {
    try {
      const filtre = filtreStatutColis(query.statut);
      if (filtre.erreur) return { success: false, message: filtre.erreur };
      const { lignes: colisRecus, pagination } = await paginer(Colis, {
        where: { recepteurId: utilisateurId, ...filtre.where },
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
      }, query);

      return {
        success: true,
        data: colisRecus,
        pagination,
        par_statut: await compterColisParStatut({ recepteurId: utilisateurId })
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
  // Pagination facultative (?page=&limit=). Sans paramètre : les 50 plus
  // récentes, comme avant. `non_lues` = total des non lues (toutes pages),
  // pour le badge.
  static async getNotifications(utilisateurId, query = {}) {
    try {
      const options = {
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
      };
      const p = lirePagination(query);
      let notificationsRecus;
      let pagination = null;
      if (p) {
        const { count, rows } = await Notifications.findAndCountAll({ ...options, limit: p.limit, offset: p.offset, distinct: true });
        notificationsRecus = rows;
        pagination = metaPagination(p, count);
      } else {
        notificationsRecus = await Notifications.findAll({ ...options, limit: 50 });
      }
      const non_lues = await Notifications.count({ where: { recepteurId: utilisateurId, statut: 'non_lu' } });

      return {
        success: true,
        data: notificationsRecus,
        pagination,
        non_lues
      };
    } catch (error) {
      logger.error('Erreur getNotifications', { error: error.message, stack: error.stack });
      return {
        success: false,
        message: error.message
      };
    }
  }

  static async marquerNotificationCommeLue(notificationId, utilisateurId) {
    try {
      // Seul le destinataire de la notification peut la marquer comme lue.
      const notif = await Notifications.findOne({
        where: { id: notificationId, recepteurId: utilisateurId },
      });
      if (!notif) {
        return { success: false, status: 404, message: 'Notification introuvable' };
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

  // 🔹 Marquer toutes les notifications non lues de l'utilisateur comme lues
  static async marquerToutesNotificationsLues(utilisateurId) {
    const [nombre] = await Notifications.update(
      { statut: 'lu' },
      { where: { recepteurId: utilisateurId, statut: 'non_lu' } }
    );
    return { success: true, nombre };
  }

}

module.exports = EnvoieColisService;
