const Paiement = require('../../models/paiement.model');
const { fn, col } = require('sequelize');
const { paginer, avecPagination } = require('../../utils/pagination');
const logger = require('../../config/logger');
const { Colis, Utilisateur } = require('../../models');
const WaveService = require('../payment/wave.service');
const OrangeMoneyService = require('../payment/orangeMoney.service');
const TauxChangeService = require('../tauxChange.service');

const BASE_URL    = process.env.BACKEND_URL   || 'http://localhost:3000';
const APP_SCHEME  = process.env.APP_DEEP_LINK || 'nanei';

// Bornes du montant réellement débité (en XOF) — remplacent l'ancien
// middleware validatePaymentAmount, qui contrôlait un montant envoyé par le
// client alors que le montant facturé est calculé ici, côté serveur.
const MONTANT_MIN_XOF = 100;
const MONTANT_MAX_XOF = 10000000;

/**
 * Montant à débiter chez Wave / Orange Money, en XOF.
 * Le prix d'un colis est stocké en EUROS (affiché en € dans l'admin et le
 * mobile) ; les opérateurs débitent en XOF : on convertit avec le taux de
 * change actif (table taux_change, 655.957 par défaut).
 */
async function montantEnXof(prixEur) {
  const taux = await TauxChangeService.getTauxActif();
  return { montantXof: Math.round(Number(prixEur) * Number(taux)), taux };
}

/** États définitifs : un webhook (rejoué, tardif ou contradictoire) ne les modifie plus. */
const STATUTS_DEFINITIFS = ['paye', 'rembourse'];

// Référence de paiement = UUID. Une autre valeur ne correspond à aucun
// paiement : on l'ignore au lieu de laisser Postgres lever une erreur (500,
// que l'opérateur rejouerait indéfiniment).
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Le montant annoncé par l'opérateur (s'il en annonce un) correspond-il au
 * montant attendu en XOF ? Un webhook « payé » pour un autre montant n'est
 * pas une preuve de paiement de CE colis.
 */
async function montantConforme(montantAnnonce, paiement, colis) {
  if (montantAnnonce === undefined || montantAnnonce === null || montantAnnonce === '') return true;
  const { montantXof } = await montantEnXof(colis?.prix ?? paiement.prixTotal);
  return Math.round(Number(montantAnnonce)) === montantXof;
}

class ClientPaiementService {

  /** Liste les paiements de l'utilisateur connecté */
  // Pagination facultative (?page=&limit=) : sans paramètre, liste complète.
  static async mesPaiements(userId, query = {}) {
    const STATUTS = ['en_attente', 'en_cours', 'paye', 'echoue', 'rembourse'];
    const where = { payeurId: userId };
    if (query.statut && query.statut !== 'tous') {
      if (!STATUTS.includes(query.statut)) {
        return { success: false, status: 400, message: `Statut invalide (${STATUTS.join(', ')})` };
      }
      where.statut = query.statut;
    }
    const { lignes: paiements, pagination } = await paginer(Paiement, {
      where,
      include: [{
        model: Colis,
        as: 'colis',
        attributes: ['id', 'reference', 'prix', 'poids', 'destination', 'type_colis', 'statut'],
      }],
      order: [['created_at', 'DESC']],
    }, query);
    // Les colonnes DECIMAL (prixTotal, montantPaye, colis.prix, colis.poids)
    // sont renvoyées en String par Sequelize/pg pour préserver la précision —
    // le mobile fait un cast strict `as num` dessus et crashe ("type 'String'
    // is not a subtype of type 'num'"). On les convertit explicitement en
    // nombre uniquement à la sérialisation JSON, sans toucher au calcul/
    // stockage interne qui reste en DECIMAL.
    const data = paiements.map((p) => {
      const json = p.toJSON();
      // Charge brute renvoyée par l'opérateur (données techniques, parfois
      // personnelles) : jamais transmise au client.
      delete json.webhookPayload;
      json.prixTotal = json.prixTotal != null ? Number(json.prixTotal) : null;
      json.montantPaye = json.montantPaye != null ? Number(json.montantPaye) : null;
      if (json.colis) {
        json.colis.prix = json.colis.prix != null ? Number(json.colis.prix) : json.colis.prix;
        json.colis.poids = json.colis.poids != null ? Number(json.colis.poids) : json.colis.poids;
      }
      return json;
    });
    // Compteurs sur TOUS les paiements du client (toutes pages, sans filtre)
    const parStatut = await Paiement.findAll({
      where: { payeurId: userId },
      attributes: ['statut', [fn('COUNT', col('id')), 'nombre']],
      group: ['statut'],
      raw: true,
    });
    const par_statut = { en_attente: 0, en_cours: 0, paye: 0, echoue: 0, rembourse: 0, total: 0 };
    for (const l of parStatut) { const n = Number(l.nombre) || 0; par_statut[l.statut] = n; par_statut.total += n; }
    return avecPagination({ success: true, data, par_statut }, pagination);
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

    // Montant calculé côté serveur à partir du prix du colis (EUR -> XOF)
    const { montantXof, taux } = await montantEnXof(colis.prix);
    if (!Number.isFinite(montantXof) || montantXof < MONTANT_MIN_XOF) {
      return { success: false, message: `Montant minimum : ${MONTANT_MIN_XOF} XOF` };
    }
    if (montantXof > MONTANT_MAX_XOF) {
      return { success: false, message: `Montant maximum : ${MONTANT_MAX_XOF} XOF` };
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
          montant:    montantXof,
          reference:  paiement.id,
          successUrl,
          errorUrl,
        });
        checkoutUrl      = result.checkoutUrl;
        referenceSession = result.referenceSession;

      } else if (moyenPaiement === 'orange_money') {
        const result = await OrangeMoneyService.initierPaiement({
          montant:   montantXof,
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

      logger.info('Paiement initié', { paiement_id: paiement.id, prix_eur: colis.prix, taux, montant_xof: montantXof, moyen: moyenPaiement });
      return {
        success: true,
        data: {
          checkoutUrl,
          paiementId: paiement.id,
          montant: montantXof,
          devise: 'XOF',
          prixEur: Number(colis.prix),
          tauxChange: taux,
        },
      };

    } catch (err) {
      logger.error(`Paiement erreur initiation`, { moyen: moyenPaiement, error: err.message, stack: err.stack, paiement_id: paiement.id });
      await paiement.update({ statut: 'echoue' });
      return { success: false, message: `Erreur lors de l'initialisation du paiement: ${err.message}` };
    }
  }

  /**
   * Traitement du retour navigateur après paiement (redirect Wave / OM).
   *
   * SÉCURITÉ : cette URL est publique et ses paramètres (statut, ref) sont
   * modifiables par n'importe qui. On ne se fie donc JAMAIS au paramètre
   * `statut` pour valider un paiement :
   *  - Wave : on interroge l'API Wave (session de checkout) et on ne marque
   *    `paye` que si Wave confirme le paiement, la référence et le montant ;
   *  - Orange Money : pas de vérification synchrone possible ici, le
   *    paiement reste `en_cours` jusqu'au webhook signé d'Orange Money.
   * Le paramètre `statut` ne sert plus qu'à choisir le message affiché.
   */
  static async traiterRetour(colisId, paiementId, statut) {
    const lien = (etat) => `${APP_SCHEME}://paiement/${etat}?colisId=${encodeURIComponent(colisId || '')}`;

    const paiement = paiementId ? await Paiement.findByPk(paiementId).catch(() => null) : null;
    if (!paiement || (colisId && paiement.colisId !== colisId)) {
      return { success: false, etat: 'echec', deepLink: lien('echec') };
    }

    if (paiement.statut === 'paye') {
      return { success: true, etat: 'succes', deepLink: lien('succes') };
    }

    if (paiement.moyenPaiement === 'wave' && paiement.referenceTransaction) {
      try {
        const session = await WaveService.verifierStatut(paiement.referenceTransaction);
        const colis = await Colis.findByPk(paiement.colisId);
        const { montantXof } = await montantEnXof(colis?.prix ?? paiement.prixTotal);
        const confirme =
          session?.checkout_status === 'complete' &&
          (!session.payment_status || session.payment_status === 'succeeded') &&
          session.client_reference === paiement.id &&
          Math.round(Number(session.amount)) === montantXof;

        if (confirme) {
          await paiement.update({
            statut: 'paye',
            montantPaye: colis?.prix ?? paiement.prixTotal,
            webhookPayload: session,
          });
          return { success: true, etat: 'succes', deepLink: lien('succes') };
        }
        if (session?.checkout_status === 'error' || session?.checkout_status === 'expired') {
          await paiement.update({ statut: 'echoue', webhookPayload: session });
          return { success: true, etat: 'echec', deepLink: lien('echec') };
        }
      } catch (err) {
        logger.warn('Vérification Wave au retour impossible', { paiement_id: paiement.id, error: err.message });
      }
    }

    // Non confirmé par l'opérateur : on n'écrit rien en base.
    if (statut !== 'succes') {
      return { success: true, etat: 'echec', deepLink: lien('echec') };
    }
    return { success: true, etat: 'verification', deepLink: lien('verification') };
  }

  /** Webhook Wave */
  static async webhookWave(payload) {
    const { client_reference, checkout_status } = payload || {};
    if (!client_reference || !UUID.test(String(client_reference))) return;
    const paiement = await Paiement.findByPk(client_reference);
    if (!paiement) return;
    // Avant : un webhook « error » rejoué après le paiement repassait un
    // paiement payé (ou remboursé) en « echoue ».
    if (STATUTS_DEFINITIFS.includes(paiement.statut)) return;

    if (checkout_status === 'complete') {
      const colis = await Colis.findByPk(paiement.colisId);
      if (!(await montantConforme(payload.amount, paiement, colis))) {
        logger.warn('Webhook Wave : montant différent du montant attendu, paiement non validé', { paiement_id: paiement.id });
        return;
      }
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
    const { order_id, status } = payload || {};
    if (!order_id || !UUID.test(String(order_id))) return;
    const paiement = await Paiement.findByPk(order_id);
    if (!paiement) return;
    if (STATUTS_DEFINITIFS.includes(paiement.statut)) return;

    if (status === 'SUCCESS') {
      const colis = await Colis.findByPk(paiement.colisId);
      if (!(await montantConforme(payload.amount, paiement, colis))) {
        logger.warn('Webhook Orange Money : montant différent du montant attendu, paiement non validé', { paiement_id: paiement.id });
        return;
      }
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
