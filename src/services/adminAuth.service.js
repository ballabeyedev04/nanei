const crypto = require('crypto');
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

// Temps de réponse minimum imposé à forgotPassword() — neutralise la faille
// de timing où le chemin "compte éligible" (JWT + écriture DB + envoi email)
// prend nettement plus longtemps que les chemins "compte inexistant/non
// éligible" (retour quasi instantané), ce qui permettait de deviner si un
// email correspond à un admin actif en mesurant le temps de réponse.
const MIN_RESPONSE_MS = 400;

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

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

    const startedAt = Date.now();

    try {
      const emailClean = email.trim().toLowerCase();
      const utilisateur = await Utilisateur.findOne({ where: { email: emailClean } });

      const eligible =
        !!utilisateur && utilisateur.role === 'Admin' && utilisateur.statut === 'actif';

      if (eligible) {
        // Génère un token opaque aléatoire — seul son hash est stocké en
        // base (comme un mot de passe), jamais le token en clair. Si la
        // base fuit, les tokens stockés sont inutilisables tels quels.
        const rawToken = crypto.randomBytes(32).toString('hex');

        // Le JWT reste utilisé comme enveloppe transmise au client (purpose
        // + expiration auto-vérifiable), mais la vérité côté serveur est le
        // hash du token opaque, pas la signature JWT seule.
        const payload = {
          id: utilisateur.id,
          email: utilisateur.email,
          role: utilisateur.role,
          purpose: 'admin-password-reset',
          rawToken
        };
        const resetToken = jwt.sign(payload, jwtConfig.resetSecret, {
          expiresIn: RESET_EXPIRES_JWT
        });

        utilisateur.resetPasswordToken = hashToken(rawToken);
        utilisateur.resetPasswordExpires = new Date(Date.now() + RESET_EXPIRES_MS);
        await utilisateur.save();

        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const resetLink = `${frontendUrl}/nanei/admin/reset-password?token=${resetToken}`;

        await sendEmail({
          to: utilisateur.email,
          subject: '🔒 Réinitialisation de votre mot de passe administrateur Nanei',
          html: adminResetTemplate({
            nom: utilisateur.nom,
            prenom: utilisateur.prenom,
            resetLink
          })
        });
      }

      // Temps de réponse constant : neutralise le side-channel de timing
      // entre le chemin "compte éligible" (plus lent) et les autres.
      const elapsed = Date.now() - startedAt;
      if (elapsed < MIN_RESPONSE_MS) {
        await new Promise((r) => setTimeout(r, MIN_RESPONSE_MS - elapsed));
      }

      return GENERIC_OK;
    } catch (error) {
      const elapsed = Date.now() - startedAt;
      if (elapsed < MIN_RESPONSE_MS) {
        await new Promise((r) => setTimeout(r, MIN_RESPONSE_MS - elapsed));
      }
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

      // 6. Double vérification côté DB — le hash du token stocké doit
      // correspondre à celui transporté dans le JWT, ET ne pas être expiré.
      const incomingHash = decoded.rawToken ? hashToken(decoded.rawToken) : null;
      if (
        !incomingHash ||
        utilisateur.resetPasswordToken !== incomingHash ||
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

      // 8. Hacher et sauvegarder + invalider toute session déjà émise
      const hashedPassword = await bcrypt.hash(nouveauMotDePasse, bcryptConfig.saltRounds);
      utilisateur.mot_de_passe = hashedPassword;
      utilisateur.resetPasswordToken = null;
      utilisateur.resetPasswordExpires = null;
      utilisateur.passwordChangedAt = new Date();
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
