const Paiement = require('../../models/paiement.model');
const logger = require('../../config/logger');
const { Colis, Utilisateur } = require('../../models');
const WaveService = require('../payment/wave.service');
const OrangeMoneyService = require('../payment/orangeMoney.service');

const BASE_URL    = process.env.BACKEND_URL   || 'http://localhost:3000';
const APP_SCHEME  = process.env.APP_DEEP_LINK || 'nanei';

class ClientPaiementService {

  /** Liste les paiements de l'utilisateur connecté */
  static async mesPaiements(userId) {
    const paiements = await Paiement.findAll({
      where: { payeurId: userId },
      include: [{
        model: Colis,
        as: 'colis',
        attributes: ['id', 'reference', 'prix', 'poids', 'destination', 'type_colis', 'statut'],
      }],
      order: [['created_at', 'DESC']],
    });
    return { success: true, data: paiements };
  }

  /**
   * Initie un paiement pour un colis.
   * Crée (ou réutilise) l'enregistrement Paiement et appelle le bon provider.
   */
  static async initierPaiement(colisId, userId, moyenPaiement) {
    // Vérifier que le colis appartient bien au payeur
    const colis = await Colis.findOne({ where: { id: colisId, expediteurId: userId } });
    if (!colis) {
      return { success: false, message: 'Colis non trouvé ou non autorisé' };
    }

    // Récupérer ou créer le paiement
    let paiement = await Paiement.findOne({ where: { colisId } });
    if (!paiement) {
      return { success: false, message: 'Paiement non trouvé pour ce colis' };
    }

    if (paiement.statut === 'paye') {
      return { success: false, message: 'Ce colis est déjà payé' };
    }

    // URLs de callback
    const successUrl = `${BASE_URL}/nanei/paiements/retour?statut=succes&colisId=${colisId}&ref=${paiement.id}`;
    const errorUrl   = `${BASE_URL}/nanei/paiements/retour?statut=echec&colisId=${colisId}&ref=${paiement.id}`;
    const notifUrl   = `${BASE_URL}/nanei/paiements/webhook/${moyenPaiement}`;

    let checkoutUrl;
    let referenceSession;

    try {
      if (moyenPaiement === 'wave') {
        const result = await WaveService.initierPaiement({
          montant:    colis.prix,
          reference:  paiement.id,
          successUrl,
          errorUrl,
        });
        checkoutUrl      = result.checkoutUrl;
        referenceSession = result.referenceSession;

      } else if (moyenPaiement === 'orange_money') {
        const result = await OrangeMoneyService.initierPaiement({
          montant:   colis.prix,
          orderId:   paiement.id,
          returnUrl: successUrl,
          cancelUrl: errorUrl,
          notifUrl,
        });
        checkoutUrl      = result.checkoutUrl;
        referenceSession = result.referenceSession;

      } else {
        return { success: false, message: 'Moyen de paiement invalide' };
      }

      // Mettre à jour le paiement
      await paiement.update({
        moyenPaiement,
        statut: 'en_cours',
        checkoutUrl,
        referenceTransaction: referenceSession,
      });

      return { success: true, data: { checkoutUrl, paiementId: paiement.id } };

    } catch (err) {
      logger.error(`Paiement erreur initiation`, { moyen: moyenPaiement, error: err.message, stack: err.stack, paiement_id: paiement.id });
      await paiement.update({ statut: 'echoue' });
      return { success: false, message: `Erreur lors de l'initialisation du paiement: ${err.message}` };
    }
  }

  /** Traitement retour paiement (redirect depuis Wave/OM) */
  static async traiterRetour(colisId, paiementId, statut) {
    const paiement = await Paiement.findByPk(paiementId);
    if (!paiement) return { success: false };

    if (statut === 'succes') {
      const colis = await Colis.findByPk(colisId);
      await paiement.update({
        statut: 'paye',
        montantPaye: colis?.prix ?? paiement.prixTotal,
      });
    } else {
      await paiement.update({ statut: 'echoue' });
    }

    // Retourner une page HTML de confirmation qui redirige vers l'app
    const deepLink = statut === 'succes'
      ? `${APP_SCHEME}://paiement/succes?colisId=${colisId}`
      : `${APP_SCHEME}://paiement/echec?colisId=${colisId}`;

    return { success: true, deepLink, statut };
  }

  /** Webhook Wave */
  static async webhookWave(payload) {
    const { client_reference, checkout_status } = payload;
    const paiement = await Paiement.findByPk(client_reference);
    if (!paiement) return;

    if (checkout_status === 'complete') {
      const colis = await Colis.findByPk(paiement.colisId);
      await paiement.update({
        statut: 'paye',
        montantPaye: colis?.prix ?? paiement.prixTotal,
        webhookPayload: payload,
      });
    } else if (checkout_status === 'error') {
      await paiement.update({ statut: 'echoue', webhookPayload: payload });
    }
  }

  /** Webhook Orange Money */
  static async webhookOrangeMoney(payload) {
    const { order_id, status } = payload;
    const paiement = await Paiement.findByPk(order_id);
    if (!paiement) return;

    if (status === 'SUCCESS') {
      const colis = await Colis.findByPk(paiement.colisId);
      await paiement.update({
        statut: 'paye',
        montantPaye: colis?.prix ?? paiement.prixTotal,
        webhookPayload: payload,
      });
    } else if (status === 'FAILED') {
      await paiement.update({ statut: 'echoue', webhookPayload: payload });
    }
  }
}

module.exports = ClientPaiementService;
