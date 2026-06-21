const { Colis, Utilisateur, ColisHistorique } = require('../../models');
const { envoyerPushNotification } = require('../notification.service');
const { sendSMS } = require('../sms.service');
const { sendEmail } = require('../resend.service');
const logger = require('../../config/logger');

const STATUT_LABELS = {
  en_attente: 'En attente',
  recupere: 'Récupéré',
  livre: 'Livré',
};

async function _notifierChangementStatut(colis, nouveauStatut, adminId) {
  const label = STATUT_LABELS[nouveauStatut] || nouveauStatut;

  // Charger expéditeur et récepteur
  const [expediteur, recepteur] = await Promise.all([
    Utilisateur.findByPk(colis.expediteurId),
    Utilisateur.findByPk(colis.recepteurId),
  ]);

  const message = `Votre colis ${colis.reference} est maintenant : ${label}. - Nanei FrancoMaliShip`;

  // Push notifications
  if (expediteur && expediteur.fcm_token) {
    await envoyerPushNotification(expediteur.fcm_token, 'Mise à jour colis', message, { colisId: colis.id, statut: nouveauStatut });
  }
  if (recepteur && recepteur.fcm_token) {
    await envoyerPushNotification(recepteur.fcm_token, 'Mise à jour colis', message, { colisId: colis.id, statut: nouveauStatut });
  }

  // SMS
  if (expediteur && expediteur.telephone) {
    await sendSMS(expediteur.telephone, message).catch((e) => logger.warn('SMS erreur expéditeur', { error: e.message }));
  }
  if (recepteur && recepteur.telephone) {
    await sendSMS(recepteur.telephone, message).catch((e) => logger.warn('SMS erreur récepteur', { error: e.message }));
  }

  // Emails
  const emailHtml = `<p>${message}</p><p>Connectez-vous sur <strong>nanei.app</strong> pour plus de détails.</p>`;
  if (expediteur && expediteur.email) {
    await sendEmail({ to: expediteur.email, subject: `Colis ${colis.reference} — ${label}`, html: emailHtml }).catch((e) => logger.warn('Email erreur expéditeur', { error: e.message }));
  }
  if (recepteur && recepteur.email && recepteur.email !== expediteur?.email) {
    await sendEmail({ to: recepteur.email, subject: `Colis ${colis.reference} — ${label}`, html: emailHtml }).catch((e) => logger.warn('Email erreur récepteur', { error: e.message }));
  }

  // Historique
  await ColisHistorique.create({
    colis_id: colis.id,
    ancien_statut: colis.statut,
    nouveau_statut: nouveauStatut,
    admin_id: adminId || null,
  });
}

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
  static async changerEnAttente(id, adminId) {
    try {
      const colis = await Colis.findByPk(id);
      if (!colis) return { success: false, message: "Colis introuvable" };
      const ancienStatut = colis.statut;
      colis.statut = "en_attente";
      await colis.save();
      await _notifierChangementStatut({ ...colis.toJSON(), statut: ancienStatut, id: colis.id, reference: colis.reference, expediteurId: colis.expediteurId, recepteurId: colis.recepteurId }, "en_attente", adminId).catch((e) => logger.warn('Erreur notification changement statut', { error: e.message }));
      return { success: true, message: "Colis mis en attente avec succès", colis };
    } catch (error) {
      throw error;
    }
  }

  // ===================== LIVRÉ =====================
  static async changerEnLivre(id, adminId) {
    try {
      const colis = await Colis.findByPk(id);
      if (!colis) return { success: false, message: "Colis introuvable" };
      const ancienStatut = colis.statut;
      colis.statut = "livre";
      await colis.save();
      await _notifierChangementStatut({ ...colis.toJSON(), statut: ancienStatut, id: colis.id, reference: colis.reference, expediteurId: colis.expediteurId, recepteurId: colis.recepteurId }, "livre", adminId).catch((e) => logger.warn('Erreur notification changement statut', { error: e.message }));
      return { success: true, message: "Colis marqué comme livré", colis };
    } catch (error) {
      throw error;
    }
  }

  // ===================== RÉCUPÉRÉ =====================
  static async changerEnRecupere(id, adminId) {
    try {
      const colis = await Colis.findByPk(id);
      if (!colis) return { success: false, message: "Colis introuvable" };
      const ancienStatut = colis.statut;
      colis.statut = "recupere";
      await colis.save();
      await _notifierChangementStatut({ ...colis.toJSON(), statut: ancienStatut, id: colis.id, reference: colis.reference, expediteurId: colis.expediteurId, recepteurId: colis.recepteurId }, "recupere", adminId).catch((e) => logger.warn('Erreur notification changement statut', { error: e.message }));
      return { success: true, message: "Colis marqué comme récupéré", colis };
    } catch (error) {
      throw error;
    }
  }

}

module.exports = GestionColisService;
