const Utilisateur = require('../models/utilisateur.model');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { jwtConfig, bcryptConfig } = require('../config/security');
const { sendEmail } = require('./resend.service');
const adminResetTemplate = require('../templates/mail/adminResetPassword.template');

/**
 * Durée d'expiration du token de réinitialisation admin : 10 minutes
 */
const RESET_EXPIRES_MS = 10 * 60 * 1000; // 10 min en ms
const RESET_EXPIRES_JWT = '10m';

class AdminAuthService {

  /**
   * Étape 1 — Demande de réinitialisation de mot de passe admin
   * Vérifications de sécurité :
   *   - L'email doit exister
   *   - L'utilisateur doit avoir le rôle Admin
   *   - Le compte doit être actif (statut = 'actif')
   * Si tout est OK, on génère un token JWT signé (10 min),
   * on stocke le hash dans resetPasswordToken + expiry, et on envoie l'email.
   *
   * Sécurité : on retourne toujours le même message générique pour ne pas
   * révéler si l'email existe ou non (anti-enumération).
   */
  static async forgotPassword(email) {
    const GENERIC_OK = {
      success: true,
      message:
        'Si cet email correspond à un compte administrateur actif, un lien de réinitialisation vous a été envoyé.'
    };

    try {
      const emailClean = email.trim().toLowerCase();
      const utilisateur = await Utilisateur.findOne({ where: { email: emailClean } });

      // Vérifications silencieuses (on ne révèle rien au client)
      if (!utilisateur) return GENERIC_OK;
      if (utilisateur.role !== 'Admin') return GENERIC_OK;
      if (utilisateur.statut !== 'actif') return GENERIC_OK;

      // Génère un token JWT signé avec le secret de reset
      const payload = {
        id: utilisateur.id,
        email: utilisateur.email,
        role: utilisateur.role,
        purpose: 'admin-password-reset' // champ purpose pour éviter la réutilisation de tokens d'autres flows
      };
      const resetToken = jwt.sign(payload, jwtConfig.resetSecret, {
        expiresIn: RESET_EXPIRES_JWT
      });

      // Stocke l'expiration en base (double vérification côté DB)
      utilisateur.resetPasswordToken = resetToken;
      utilisateur.resetPasswordExpires = new Date(Date.now() + RESET_EXPIRES_MS);
      await utilisateur.save();

      // Construit le lien vers le frontend admin
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const resetLink = `${frontendUrl}/nanei/admin/reset-password?token=${resetToken}`;

      // Envoi email
      await sendEmail({
        to: utilisateur.email,
        subject: '🔒 Réinitialisation de votre mot de passe administrateur Nanei',
        html: adminResetTemplate({
          nom: utilisateur.nom,
          prenom: utilisateur.prenom,
          resetLink
        })
      });

      return GENERIC_OK;
    } catch (error) {
      // On propage l'erreur (erreur serveur, pas une erreur métier)
      throw error;
    }
  }

  /**
   * Étape 2 — Réinitialisation effective du mot de passe admin
   * Vérifications de sécurité :
   *   - Le token JWT doit être valide et non expiré
   *   - Le champ purpose doit être 'admin-password-reset'
   *   - L'utilisateur doit exister et avoir le rôle Admin
   *   - Le compte doit être actif
   *   - Le token en base doit correspondre et ne pas être expiré (double vérification)
   *   - Le nouveau mot de passe doit respecter la politique de sécurité
   */
  static async resetPassword(token, nouveauMotDePasse) {
    try {
      // 1. Vérifier la signature JWT
      let decoded;
      try {
        decoded = jwt.verify(token, jwtConfig.resetSecret);
      } catch (jwtError) {
        return {
          success: false,
          message: 'Lien de réinitialisation invalide ou expiré. Veuillez faire une nouvelle demande.'
        };
      }

      // 2. Vérifier le champ purpose
      if (decoded.purpose !== 'admin-password-reset') {
        return {
          success: false,
          message: 'Token non autorisé pour cette opération.'
        };
      }

      // 3. Récupérer l'utilisateur depuis la base
      const utilisateur = await Utilisateur.findByPk(decoded.id);

      if (!utilisateur) {
        return { success: false, message: 'Compte introuvable.' };
      }

      // 4. Vérifier rôle Admin
      if (utilisateur.role !== 'Admin') {
        return { success: false, message: 'Opération non autorisée pour ce type de compte.' };
      }

      // 5. Vérifier que le compte est actif
      if (utilisateur.statut !== 'actif') {
        return { success: false, message: 'Votre compte est désactivé. Contactez le support.' };
      }

      // 6. Double vérification côté DB — le token stocké doit correspondre ET ne pas être expiré
      if (
        utilisateur.resetPasswordToken !== token ||
        !utilisateur.resetPasswordExpires ||
        new Date() > utilisateur.resetPasswordExpires
      ) {
        return {
          success: false,
          message: 'Lien de réinitialisation invalide ou expiré. Veuillez faire une nouvelle demande.'
        };
      }

      // 7. Politique de mot de passe
      const policyError = AdminAuthService._validatePasswordPolicy(nouveauMotDePasse);
      if (policyError) {
        return { success: false, message: policyError };
      }

      // 8. Hacher et sauvegarder
      const hashedPassword = await bcrypt.hash(nouveauMotDePasse, bcryptConfig.saltRounds);
      utilisateur.mot_de_passe = hashedPassword;
      utilisateur.resetPasswordToken = null;
      utilisateur.resetPasswordExpires = null;
      await utilisateur.save();

      return {
        success: true,
        message: 'Mot de passe réinitialisé avec succès. Vous pouvez maintenant vous connecter.'
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Politique de sécurité des mots de passe admin
   * @returns {string|null} message d'erreur ou null si valide
   */
  static _validatePasswordPolicy(password) {
    if (!password || password.length < 8)
      return 'Le mot de passe doit contenir au moins 8 caractères.';
    if (!/[A-Z]/.test(password))
      return 'Le mot de passe doit contenir au moins une lettre majuscule.';
    if (!/[a-z]/.test(password))
      return 'Le mot de passe doit contenir au moins une lettre minuscule.';
    if (!/[0-9]/.test(password))
      return 'Le mot de passe doit contenir au moins un chiffre.';
    if (!/[!@#$%^&*]/.test(password))
      return 'Le mot de passe doit contenir au moins un caractère spécial (!@#$%^&*).';
    return null;
  }
}

module.exports = AdminAuthService;
