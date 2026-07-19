const Utilisateur = require('../models/utilisateur.model');
const bcrypt      = require('bcrypt');
const sequelize   = require('../config/db');
const logger      = require('../config/logger');
const { bcryptConfig } = require('../config/security');

class AccountService {

  // ── PROFIL COURANT ────────────────────────────────────────────────────────────
  static async getMe(userId) {
    const utilisateur = await Utilisateur.findByPk(userId, {
      attributes: { exclude: ['mot_de_passe'] }
    });
    if (!utilisateur) return { success: false, message: 'Utilisateur introuvable' };
    return { success: true, utilisateur };
  }

  // NB : forgotPassword / resetPassword (OTP) ont été retirés (dead code,
  // jamais appelés — le mobile utilise AuthService.oublierPassword/
  // resetPassword, voir services/auth.service.js).

  // ── CHANGER MOT DE PASSE ──────────────────────────────────────────────────────
  static async changePassword(userId, oldPassword, newPassword) {
    try {
      const utilisateur = await Utilisateur.findByPk(userId);
      if (!utilisateur) return { error: "Utilisateur non trouvé." };

      const isMatch = await bcrypt.compare(oldPassword, utilisateur.mot_de_passe);
      if (!isMatch) return { error: "Mot de passe actuel incorrect." };

      if (newPassword.length < 8) {
        return { error: "Le mot de passe doit contenir au moins 8 caractères." };
      }

      utilisateur.mot_de_passe = await bcrypt.hash(newPassword, bcryptConfig.saltRounds);
      await utilisateur.save();

      return { message: "Mot de passe modifié avec succès." };
    } catch (error) {
      logger.error('Erreur changePassword', { error: error.message, stack: error.stack });
      throw error;
    }
  }

  // ── MODIFIER PROFIL ───────────────────────────────────────────────────────────
  static async updateProfile({ userId, data }) {
    const { nom, prenom, email, telephone, adresse, photoProfil } = data;
    const t = await sequelize.transaction();
    try {
      const utilisateur = await Utilisateur.findByPk(userId, { transaction: t });
      if (!utilisateur) {
        await t.rollback();
        return { error: "Utilisateur non trouvé" };
      }

      if (email && email !== utilisateur.email) {
        const exist = await Utilisateur.findOne({ where: { email }, transaction: t });
        if (exist) { await t.rollback(); return { error: "Cet email est déjà utilisé" }; }
        utilisateur.email = email;
      }

      if (telephone && telephone !== utilisateur.telephone) {
        const exist = await Utilisateur.findOne({ where: { telephone }, transaction: t });
        if (exist) { await t.rollback(); return { error: "Ce numéro de téléphone est déjà utilisé" }; }
        utilisateur.telephone = telephone;
      }

      if (nom)       utilisateur.nom     = nom;
      if (prenom)    utilisateur.prenom  = prenom;
      if (adresse !== undefined) utilisateur.adresse = adresse;
      if (photoProfil)           utilisateur.photoProfil = photoProfil;

      await utilisateur.save({ transaction: t });
      await t.commit();

      return { message: "Profil modifié avec succès", utilisateur };
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }
}

module.exports = AccountService;
