const Paiement = require('../../models/paiement.model');
const { Op } = require('sequelize');
const { paginer, motifRecherche, avecPagination } = require('../../utils/pagination');
const { Colis, Utilisateur } = require('../../models');

// Les colonnes DECIMAL (prixTotal, montantPaye, colis.poids) arrivent en
// CHAÎNE depuis Postgres : on les renvoie en nombres. Montants en EUR (prix du
// colis) ; le montant XOF débité par l'opérateur = prix × taux de change.
const enNombre = (v) => (v === null || v === undefined || v === '' ? null : Number(v));

function versJson(paiement) {
  const json = paiement.toJSON();
  json.prixTotal = enNombre(json.prixTotal);
  json.montantPaye = enNombre(json.montantPaye);
  if (json.colis) json.colis.poids = enNombre(json.colis.poids);
  delete json.webhookPayload; // charge brute de l'opérateur, inutile à l'écran
  return json;
}

const STATUTS = ['en_attente', 'en_cours', 'paye', 'echoue', 'rembourse'];

class AdminPaiementService {

  // Query : page, limit (pagination facultative), statut, q (référence du
  // colis, destination, nom / prénom / e-mail du payeur, référence opérateur)
  static async listePaiements(query = {}) {
    const where = {};
    if (query.statut) {
      if (!STATUTS.includes(query.statut)) {
        return { success: false, status: 400, message: `Statut invalide. Valeurs: ${STATUTS.join(', ')}` };
      }
      where.statut = query.statut;
    }
    const motif = motifRecherche(query.q);
    if (motif) {
      where[Op.or] = [
        { '$colis.reference$': { [Op.iLike]: motif } },
        { '$colis.destination$': { [Op.iLike]: motif } },
        { '$payeur.nom$': { [Op.iLike]: motif } },
        { '$payeur.prenom$': { [Op.iLike]: motif } },
        { '$payeur.email$': { [Op.iLike]: motif } },
        { referenceTransaction: { [Op.iLike]: motif } },
      ];
    }
    const { lignes: paiements, pagination } = await paginer(Paiement, {
      where,
      subQuery: false, // filtres sur les tables jointes ($colis.reference$…)
      include: [
        {
          model: Colis,
          as: 'colis',
          attributes: ['id', 'reference', 'poids', 'destination', 'type_colis', 'statut'],
        },
        {
          model: Utilisateur,
          as: 'payeur',
          attributes: ['id', 'nom', 'prenom', 'email', 'telephone'],
        },
      ],
      order: [['created_at', 'DESC']],
    }, query);
    return avecPagination({ success: true, data: paiements.map(versJson) }, pagination);
  }

  static async changerStatut(id, statut) {
    if (!STATUTS.includes(statut)) {
      return { success: false, status: 400, message: `Statut invalide. Valeurs: ${STATUTS.join(', ')}` };
    }
    const paiement = await Paiement.findByPk(id);
    if (!paiement) return { success: false, status: 404, message: 'Paiement non trouvé' };
    const maj = { statut };
    // Paiement validé à la main (espèces, virement…) : le montant encaissé
    // est le prix du colis. Sans cela, il n'était compté ni dans « Montant
    // encaissé » ni dans le rapport mensuel.
    if (statut === 'paye' && !(Number(paiement.montantPaye) > 0)) maj.montantPaye = paiement.prixTotal;
    await paiement.update(maj);
    return { success: true, message: 'Statut mis à jour', data: versJson(paiement) };
  }

  static async statistiques() {
    const [total, paye, enAttente, enCours, echoue, rembourse] = await Promise.all([
      Paiement.count(),
      Paiement.count({ where: { statut: 'paye' } }),
      Paiement.count({ where: { statut: 'en_attente' } }),
      Paiement.count({ where: { statut: 'en_cours' } }),
      Paiement.count({ where: { statut: 'echoue' } }),
      Paiement.count({ where: { statut: 'rembourse' } }),
    ]);
    const somme = await Paiement.sum('montantPaye', { where: { statut: 'paye' } });
    const montantTotal = Math.round((Number(somme) || 0) * 100) / 100; // EUR
    return { success: true, data: { total, paye, enAttente, enCours, echoue, rembourse, montantTotal } };
  }
}

module.exports = AdminPaiementService;
