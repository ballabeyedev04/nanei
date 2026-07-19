const Utilisateur = require('../models/utilisateur.model');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { jwtConfig, bcryptConfig } = require('../config/security');
const sequelize = require('../config/db');
const crypto = require("crypto");
const logger = require('../config/logger');
const { sendOtpEmail } = require('./resend.service');

class AuthService {

  // -------------------- INSCRIPTION --------------------
  static async register({
    nom,
    prenom,
    email,
    mot_de_passe,
    adresse,
    telephone,
    role = 'Particulier',
  }) {
    const t = await sequelize.transaction();
    logger.debug('Début inscription utilisateur', { nom, prenom, role });

    try {

      //email obligatoire 
      if (!email) {
        await t.rollback();
        return {
          success: false,
          message: "L'email est obligatoire"
        };
      }

      //telephone obligatoire
      if (!telephone) {
        await t.rollback();
        return {
          success: false,
          message: "Le numéro de téléphone est obligatoire"
        };
      }

      //mot de passe obligatoire 
      if (!mot_de_passe) {
        await t.rollback();
        return {
          success: false,
          message: "Le mot de passe est obligatoire"
        };
      }

      const emailClean = email.trim().toLowerCase();

      const exist = await Utilisateur.findOne({
        where: { email: emailClean },
        transaction: t
      });

      if (exist) {
        await t.rollback();
        return {
          success: false,
          message: "Cet email est déjà utilisé"
        };
      }

      // Normaliser le téléphone : si falsy, le passer comme null pour éviter les valeurs undefined
      const tel = telephone || null;
      const telExist = await Utilisateur.findOne({
        where: { telephone: tel },
        transaction: t
      });

      if (telExist) {
        await t.rollback();
        return {
          success: false,
          message: "Ce numéro de téléphone est déjà utilisé"
        };
      }


      const hashedPassword = await bcrypt.hash(
        mot_de_passe,
        bcryptConfig.saltRounds
      );
      const utilisateur = await Utilisateur.create({
        nom,
        prenom,
        email: emailClean,
        mot_de_passe: hashedPassword,
        adresse,
        telephone: tel,
        role,

      }, { transaction: t });

      await t.commit();
      return {
        success: true,
        message: "Inscription réussie",
        utilisateur
      };

    } catch (err) {
      await t.rollback();
      throw err;
    }
  }


  // -------------------- CONNEXION --------------------
  static async login({ identifiant, mot_de_passe }) {
    const isEmail = /\S+@\S+\.\S+/.test(identifiant);
    const utilisateur = await Utilisateur.findOne({
      where: isEmail ? { email: identifiant.trim().toLowerCase() } : { telephone: identifiant },
    });

    if (!utilisateur)
      return {
        success: false,
        error: 'Identifiant ou mot de passe incorrect'
      };
    if (utilisateur.statut !== 'actif') {
      return {
        success: false,
        message: `Compte ${utilisateur.statut}`
      };
    }

    const valid = await bcrypt.compare(mot_de_passe, utilisateur.mot_de_passe);
    if (!valid) {
      return {
        success: false,
        message: 'Identifiant ou mot de passe incorrect'
      };
    }

    const token = jwt.sign({
      id: utilisateur.id,
      nom: utilisateur.nom,
      prenom: utilisateur.prenom,
      email: utilisateur.email,
      adresse: utilisateur.adresse,
      telephone: utilisateur.telephone,
      photoProfil: utilisateur.photoProfil,
      role: utilisateur.role
    }, jwtConfig.secret, { expiresIn: jwtConfig.expiresIn });

    return { success: true, token, utilisateur };
  }

  //oublie le password
  static async oublierPassword(email) {
    try {
      const UserOtp = require('../models/userOtp.model');
      const utilisateur = await Utilisateur.findOne({ where: { email: email.trim().toLowerCase() } });

      // Email inexistant → réponse générique (sécurité)
      if (!utilisateur) {
        return { success: true, message: 'Si un compte existe avec cet email, un code de réinitialisation a été envoyé.' };
      }

      // Bloquer les admins
      if (utilisateur.role === 'Admin') {
        return { success: false, message: 'Action non autorisée' };
      }

      // Générer OTP 6 chiffres
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      const otpHash = await bcrypt.hash(otpCode, bcryptConfig.saltRounds); // SÉCURITÉ: Hasher le code
      const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Supprimer l'ancien OTP s'il existe, créer le nouveau dans la table UserOtp
      await UserOtp.destroy({ where: { utilisateurId: utilisateur.id } });
      await UserOtp.create({
        utilisateurId: utilisateur.id,
        otpHash,
        expiresAt: otpExpires,
        failedAttempts: 0,
        lockedUntil: null
      });

      // Envoyer par email via Resend
      await sendOtpEmail({
        to: utilisateur.email,
        nom: `${utilisateur.prenom} ${utilisateur.nom}`,
        otp: otpCode,
      });

      return { success: true, message: 'Si un compte existe avec cet email, un code de réinitialisation a été envoyé.' };
    } catch (error) {
      // Ne jamais exposer l'erreur brute du provider mail (ex: "API key is
      // invalid" quand RESEND_API_KEY est mal configurée côté serveur) —
      // le client ne doit voir qu'un message générique, l'erreur réelle
      // reste dans les logs pour le diagnostic.
      logger.error('Erreur oublierPassword', { error: error.message, stack: error.stack });
      throw new Error("Impossible d'envoyer l'email pour le moment. Veuillez réessayer plus tard.");
    }
  }

  //reset le password
  static async resetPassword(email, otpCode, motDePasse) {
    try {
      const UserOtp = require('../models/userOtp.model');
      const utilisateur = await Utilisateur.findOne({
        where: { email: email.trim().toLowerCase() }
      });

      if (!utilisateur) {
        return { success: false, message: 'Compte introuvable' };
      }

      const otpRecord = await UserOtp.findOne({ where: { utilisateurId: utilisateur.id } });
      if (!otpRecord) {
        return { success: false, message: 'Aucun code de réinitialisation trouvé. Veuillez refaire la demande.' };
      }

      // SÉCURITÉ: Vérifier le blocage (brute-force protection)
      if (otpRecord.lockedUntil && new Date() < otpRecord.lockedUntil) {
        const minutesRestantes = Math.ceil((otpRecord.lockedUntil - new Date()) / 60000);
        return { success: false, message: `Trop de tentatives. Réessayez dans ${minutesRestantes} minute(s).` };
      }

      if (new Date() > otpRecord.expiresAt) {
        await otpRecord.destroy();
        return { success: false, message: 'Code expiré. Veuillez refaire la demande.' };
      }

      if (!motDePasse || motDePasse.length < 6) {
        return { success: false, message: 'Le mot de passe doit contenir au moins 6 caractères' };
      }

      // SÉCURITÉ: Vérifier avec bcrypt.compare, pas comparaison en clair
      const isValid = await bcrypt.compare(otpCode, otpRecord.otpHash);
      if (!isValid) {
        // SÉCURITÉ: Incrémenter les tentatives échouées et bloquer après 3
        await otpRecord.increment('failedAttempts');
        if (otpRecord.failedAttempts + 1 >= 3) {
          const lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // Blocage 15 min
          await otpRecord.update({ lockedUntil });
          logger.warn(`OTP brute-force : compte bloqué`, { user_id: utilisateur.id, attempts: otpRecord.failedAttempts + 1 });
          return { success: false, message: `Trop de tentatives. Réessayez dans 15 minutes.` };
        }
        return { success: false, message: `Code incorrect (${3 - otpRecord.failedAttempts - 1} tentatives restantes).` };
      }

      utilisateur.mot_de_passe = await bcrypt.hash(motDePasse, bcryptConfig.saltRounds);
      utilisateur.otpCode = null; // Nettoyer les anciens champs s'ils existent
      utilisateur.otpExpires = null;
      await utilisateur.save();
      await otpRecord.destroy();

      return { success: true, message: 'Mot de passe réinitialisé avec succès' };
    } catch (error) {
      logger.error('Erreur resetPassword', { error: error.message, stack: error.stack });
      throw error;
    }
  }

}

module.exports = AuthService;
