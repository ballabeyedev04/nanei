const Paiement = require('../../models/paiement.model');
const { Colis, Utilisateur } = require('../../models');

class AdminPaiementService {

  static async listePaiements() {
    const paiements = await Paiement.findAll({
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
    });
    return { success: true, data: paiements };
  }

  static async changerStatut(id, statut) {
    const valides = ['en_attente', 'en_cours', 'paye', 'echoue', 'rembourse'];
    if (!valides.includes(statut)) {
      return { success: false, message: `Statut invalide. Valeurs: ${valides.join(', ')}` };
    }
    const paiement = await Paiement.findByPk(id);
    if (!paiement) return { success: false, message: 'Paiement non trouvé' };
    await paiement.update({ statut });
    return { success: true, message: 'Statut mis à jour', data: paiement };
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
    const montantTotal = (await Paiement.sum('montant_paye', { where: { statut: 'paye' } })) ?? 0;
    return { success: true, data: { total, paye, enAttente, enCours, echoue, rembourse, montantTotal } };
  }
}

module.exports = AdminPaiementService;
