const Utilisateur = require('../models/utilisateur.model');
const UserOtp     = require('../models/userOtp.model');
const bcrypt      = require('bcryptjs');
const crypto      = require('crypto');
const sequelize   = require('../config/db');
const { bcryptConfig } = require('../config/security');
const { sendOtpEmail } = require('./resend.service');

class AccountService {

  // ── PROFIL COURANT ────────────────────────────────────────────────────────────
  static async getMe(userId) {
    const utilisateur = await Utilisateur.findByPk(userId, {
      attributes: { exclude: ['mot_de_passe'] }
    });
    if (!utilisateur) return { success: false, message: 'Utilisateur introuvable' };
    return { success: true, utilisateur };
  }

  // ── MOT DE PASSE OUBLIÉ (OTP par email) ──────────────────────────────────────
  static _generateOtp(length = 8) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let otp = '';
    const bytes = crypto.randomBytes(length);
    for (let i = 0; i < length; i++) {
      otp += chars[bytes[i] % chars.length];
    }
    return otp;
  }

  static async forgotPassword(email) {
    try {
      const utilisateur = await Utilisateur.findOne({ where: { email } });
      if (!utilisateur) {
        // Réponse générique — ne révèle pas si le compte existe
        return { message: "Si un compte existe avec cet email, un code de réinitialisation a été envoyé." };
      }

      const otp       = AccountService._generateOtp(8);
      const otpHash   = await bcrypt.hash(otp, bcryptConfig.saltRounds);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1h

      // Supprimer l'ancien OTP si existant, puis créer le nouveau
      await UserOtp.destroy({ where: { utilisateurId: utilisateur.id } });
      await UserOtp.create({ utilisateurId: utilisateur.id, otpHash, expiresAt });

      await sendOtpEmail({ to: email, nom: utilisateur.nom, otp });

      return { message: "Un code de réinitialisation a été envoyé à votre adresse email." };
    } catch (error) {
      console.error('Erreur forgotPassword:', error);
      throw error;
    }
  }

  // ── RÉINITIALISATION MOT DE PASSE (OTP) ──────────────────────────────────────
  static async resetPassword(email, otpRecu, newPassword) {
    try {
      const utilisateur = await Utilisateur.findOne({ where: { email } });
      if (!utilisateur) {
        return { error: 'Aucun compte trouvé avec cet email.' };
      }

      const otpRecord = await UserOtp.findOne({ where: { utilisateurId: utilisateur.id } });
      if (!otpRecord) {
        return { error: 'Aucun code de réinitialisation trouvé. Veuillez refaire la demande.' };
      }

      if (new Date() > otpRecord.expiresAt) {
        await otpRecord.destroy();
        return { error: 'Le code a expiré. Veuillez refaire la demande.' };
      }

      const isValid = await bcrypt.compare(otpRecu.toUpperCase().trim(), otpRecord.otpHash);
      if (!isValid) {
        return { error: 'Code incorrect. Vérifiez le code reçu par email.' };
      }

      utilisateur.mot_de_passe = await bcrypt.hash(newPassword, bcryptConfig.saltRounds);
      await utilisateur.save();
      await otpRecord.destroy();

      return { message: 'Mot de passe réinitialisé avec succès.' };
    } catch (error) {
      console.error('Erreur resetPassword:', error);
      throw error;
    }
  }

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
      console.error("Erreur changePassword:", error);
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
