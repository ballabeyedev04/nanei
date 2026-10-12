const { Op, fn, col } = require('sequelize');
const { Colis, Utilisateur, ColisHistorique } = require('../../models');
const { paginer, motifRecherche, avecPagination } = require('../../utils/pagination');
const { echapperHtml } = require('../../utils/echapperHtml');
const { envoyerPushNotification } = require('../notification.service');
const { sendSMS } = require('../sms.service');
const { sendEmail } = require('../resend.service');
const logger = require('../../config/logger');

const STATUT_LABELS = {
  en_attente: 'En attente',
  recupere: 'Récupéré',
  livre: 'Livré',
};

/**
 * Après un changement de statut : ligne d'historique (attendue, fait partie
 * de l'opération) puis notifications push / SMS / e-mail en ARRIÈRE-PLAN.
 * Avant, la réponse attendait tous les envois : un fournisseur lent faisait
 * dépasser le délai de l'admin (15 s), qui affichait « Erreur » alors que le
 * statut avait bien changé.
 */
async function _notifierChangementStatut(colis, nouveauStatut, adminId) {
  if (colis.statut === nouveauStatut) return; // rien n'a changé : pas de doublon

  await ColisHistorique.create({
    colis_id: colis.id,
    ancien_statut: colis.statut,
    nouveau_statut: nouveauStatut,
    admin_id: adminId || null,
  });

  _envoyerNotifications(colis, nouveauStatut).catch((e) =>
    logger.warn('Erreur notification changement statut', { colis_id: colis.id, error: e.message }));
}

async function _envoyerNotifications(colis, nouveauStatut) {
  const label = STATUT_LABELS[nouveauStatut] || nouveauStatut;

  // Charger expéditeur et récepteur
  const [expediteur, recepteur] = await Promise.all([
    Utilisateur.findByPk(colis.expediteurId),
    Utilisateur.findByPk(colis.recepteurId),
  ]);

  const message = `Votre colis ${colis.reference} est maintenant : ${label}. - Nanei FrancoMaliShip`;

  // Push notifications
  if (expediteur && expediteur.fcm_token) {
    await envoyerPushNotification(expediteur.fcm_token, 'Mise à jour colis', message, { colisId: colis.id, statut: nouveauStatut }).catch((e) => logger.warn('Push erreur expéditeur', { error: e.message }));
  }
  if (recepteur && recepteur.fcm_token) {
    await envoyerPushNotification(recepteur.fcm_token, 'Mise à jour colis', message, { colisId: colis.id, statut: nouveauStatut }).catch((e) => logger.warn('Push erreur récepteur', { error: e.message }));
  }

  // SMS
  if (expediteur && expediteur.telephone) {
    await sendSMS(expediteur.telephone, message).catch((e) => logger.warn('SMS erreur expéditeur', { error: e.message }));
  }
  if (recepteur && recepteur.telephone) {
    await sendSMS(recepteur.telephone, message).catch((e) => logger.warn('SMS erreur récepteur', { error: e.message }));
  }

  // Emails (jamais vers les adresses techniques des comptes destinataires
  // sans e-mail ni vers un compte supprimé)
  const emailReel = (u) => u && u.email && !/@(nanei\.local|compte-supprime\.invalid)$/i.test(u.email);
  const emailHtml = `<p>${echapperHtml(message)}</p><p>Connectez-vous sur <strong>nanei.app</strong> pour plus de détails.</p>`;
  if (emailReel(expediteur)) {
    await sendEmail({ to: expediteur.email, subject: `Colis ${colis.reference} — ${label}`, html: emailHtml }).catch((e) => logger.warn('Email erreur expéditeur', { error: e.message }));
  }
  if (emailReel(recepteur) && recepteur.email !== expediteur?.email) {
    await sendEmail({ to: recepteur.email, subject: `Colis ${colis.reference} — ${label}`, html: emailHtml }).catch((e) => logger.warn('Email erreur récepteur', { error: e.message }));
  }
}

/**
 * Liste des colis (admin), facultativement filtrée par statut.
 * Query : `page`, `limit` (pagination facultative, voir utils/pagination.js)
 * et `q` (recherche sur la référence et la destination).
 */
async function listerColis(statut, query = {}, message) {
  const where = {};
  if (statut) where.statut = statut;
  const motif = motifRecherche(query.q);
  if (motif) {
    where[Op.or] = [
      { reference: { [Op.iLike]: motif } },
      { destination: { [Op.iLike]: motif } },
    ];
  }
  const { lignes, pagination } = await paginer(Colis, {
    where,
    include: [
      { model: Utilisateur, as: 'expediteur', attributes: ['nom', 'prenom', 'email', 'telephone'] },
      { model: Utilisateur, as: 'recepteur', attributes: ['nom', 'prenom', 'email', 'telephone'] },
    ],
    order: [['created_at', 'DESC']],
  }, query);

  // Taille réelle de chaque lot (toutes pages) : avec la pagination, l'admin
  // ne peut plus la compter sur la liste affichée.
  const lots = [...new Set(lignes.map((c) => c.lot_id).filter(Boolean))];
  const tailles = {};
  if (lots.length) {
    const comptes = await Colis.findAll({
      where: { lot_id: { [Op.in]: lots } },
      attributes: ['lot_id', [fn('COUNT', col('id')), 'nombre']],
      group: ['lot_id'],
      raw: true,
    });
    for (const l of comptes) tailles[l.lot_id] = Number(l.nombre) || 0;
  }
  const colis = lignes.map((c) => {
    const json = c.toJSON();
    if (json.lot_id) json.taille_lot = tailles[json.lot_id] || 1;
    return json;
  });
  return avecPagination({ success: true, message, colis }, pagination);
}

/**
 * Transitions de statut autorisées (admin). Avant : aucune règle, un colis
 * livré pouvait repasser « en attente » et renvoyer push, SMS et e-mails.
 *  - en_attente → recupere, livre
 *  - recupere   → livre, en_attente (correction d'une erreur de saisie)
 *  - livre      → (aucune : statut définitif)
 */
const TRANSITIONS = {
  en_attente: ['recupere', 'livre'],
  recupere: ['livre', 'en_attente'],
  livre: [],
};

async function changerStatut(id, nouveauStatut, adminId, message) {
  const colis = await Colis.findByPk(id);
  if (!colis) return { success: false, status: 404, message: 'Colis introuvable' };

  const ancienStatut = colis.statut;
  if (ancienStatut === nouveauStatut) {
    return { success: false, status: 409, message: `Le colis est déjà « ${STATUT_LABELS[nouveauStatut] || nouveauStatut} »` };
  }
  const permis = TRANSITIONS[ancienStatut] || [];
  if (!permis.includes(nouveauStatut)) {
    return {
      success: false,
      status: 409,
      message: ancienStatut === 'livre'
        ? 'Un colis livré ne peut plus changer de statut'
        : `Passage de « ${STATUT_LABELS[ancienStatut] || ancienStatut} » à « ${STATUT_LABELS[nouveauStatut] || nouveauStatut} » non autorisé`,
    };
  }

  colis.statut = nouveauStatut;
  await colis.save();
  await _notifierChangementStatut(
    { id: colis.id, reference: colis.reference, expediteurId: colis.expediteurId, recepteurId: colis.recepteurId, statut: ancienStatut },
    nouveauStatut, adminId,
  ).catch((e) => logger.warn('Erreur historique changement statut', { error: e.message }));
  return { success: true, message, colis };
}

class GestionColisService {

  //liste de tous les colis
  static async listeTousLesColis(query = {}) {
    return listerColis(null, query, 'Colis récupérés avec succès');
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
      throw new Error('Erreur lors du comptage des colis', { cause: error });
    }
  }

  //liste des colis recupere
  static async listeColisRecuperes(query = {}) {
    return listerColis('recupere', query, 'Colis récupérés avec succès');
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
      throw new Error('Erreur lors du comptage des colis récupérés', { cause: error });
    }
  }

  //liste des colis en attente
  static async listeColisEnAttente(query = {}) {
    return listerColis('en_attente', query, 'Colis en attente récupérés avec succès');
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
      throw new Error('Erreur lors du comptage des colis en attente', { cause: error });
    }
  }

  //liste des colis livres
  static async listeColisLivres(query = {}) {
    return listerColis('livre', query, 'Colis livrés récupérés avec succès');
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
      throw new Error('Erreur lors du comptage des colis livrés', { cause: error });
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
      throw new Error('Erreur lors de la recherche du colis', { cause: error });
    }
  }

  // ===================== CHANGEMENTS DE STATUT =====================
  static async changerEnAttente(id, adminId) {
    return changerStatut(id, 'en_attente', adminId, 'Colis mis en attente avec succès');
  }

  static async changerEnLivre(id, adminId) {
    return changerStatut(id, 'livre', adminId, 'Colis marqué comme livré');
  }

  static async changerEnRecupere(id, adminId) {
    return changerStatut(id, 'recupere', adminId, 'Colis marqué comme récupéré');
  }

}

module.exports = GestionColisService;
