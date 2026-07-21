const TauxChange = require('../models/tauxChange.model');

class TauxChangeService {
  static async getAll() {
    const taux = await TauxChange.findAll({ order: [['createdAt', 'ASC']] });
    return { success: true, data: taux };
  }

  static async getById(id) {
    const taux = await TauxChange.findByPk(id);
    if (!taux) return { success: false, message: 'Taux de change non trouvé' };
    return { success: true, data: taux };
  }

  static async update(id, data) {
    const taux = await TauxChange.findByPk(id);
    if (!taux) return { success: false, message: 'Taux de change non trouvé' };

    const valeur = Number(data.valeur);
    if (!valeur || valeur <= 0) {
      return { success: false, message: 'La valeur du taux doit être un nombre positif' };
    }

    await taux.update({ valeur });
    return { success: true, message: 'Taux de change mis à jour', data: taux };
  }

  // Utilisé par la route publique consommée par le mobile — retourne le taux
  // actif EUR -> FCFA (fallback sur le taux fixe officiel si absent en base).
  static async getTauxActif() {
    const taux = await TauxChange.findOne({
      where: { devise_source: 'EUR', devise_cible: 'FCFA' },
      order: [['createdAt', 'ASC']],
    });
    return taux ? taux.valeur : 655.957;
  }
}

module.exports = TauxChangeService;
