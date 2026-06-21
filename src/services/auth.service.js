const Utilisateur = require('../models/utilisateur.model');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { jwtConfig, bcryptConfig } = require('../config/security');
const sequelize = require('../config/db');
const { uploadImage } = require('../middlewares/uploadService'); // ton upload vers Cloudinary
const crypto = require("crypto");
const { Op } = require('sequelize');
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

  //modifier password 
  static async modifierPassword(id, nouveauPassword, ancienPassword) {
    try {
      const utilisateur = await Utilisateur.findByPk(id);
      if (!utilisateur) {
        return {
          success: false,
          message: 'Utilisateur non trouvé'
        };
      }

      //ancien password incorect 
      const valid = await bcrypt.compare(ancienPassword, utilisateur.mot_de_passe);
      if (!valid) {
        return {
          success: false,
          message: 'Ancien mot de passe incorrect'
        };
      }

      //nouveau password est identique à l'ancien password
      if (nouveauPassword === ancienPassword) {
        return {
          success: false,
          message: 'Les deux mots de passe ne doit pas être identique'
        };
      }

      //nouveau password doit contenir au moins 8 caractères
      if (nouveauPassword.length < 8) {
        return {
          success: false,
          message: 'Le nouveau mot de passe doit contenir au moins 8 caractères'
        };
      }

      //nouveau password doit contenir au moins une lettre majuscule
      if (!/[A-Z]/.test(nouveauPassword)) {
        return {
          success: false,
          message: 'Le nouveau mot de passe doit contenir au moins une lettre majuscule'
        };
      }

      //nouveau password doit contenir au moins une lettre minuscule
      if (!/[a-z]/.test(nouveauPassword)) {
        return {
          success: false,
          message: 'Le nouveau mot de passe doit contenir au moins une lettre minuscule'
        };
      }

      //nouveau password doit contenir au moins un chiffre
      if (!/[0-9]/.test(nouveauPassword)) {
        return {
          success: false,
          message: 'Le nouveau mot de passe doit contenir au moins un chiffre'
        };
      }

      //nouveau password doit contenir au moins un caractère spécial
      if (!/[!@#$%^&*]/.test(nouveauPassword)) {
        return {
          success: false,
          message: 'Le nouveau mot de passe doit contenir au moins un caractère spécial'
        };
      }

      const hashedPassword = await bcrypt.hash(nouveauPassword, bcryptConfig.saltRounds);
      utilisateur.mot_de_passe = hashedPassword;
      await utilisateur.save();
      return {
        success: true,
        message: 'Mot de passe modifié avec succès'
      };
    } catch (error) {
      throw error;
    }
  }

  //modifier le profil
  static async modifierProfil(id, nom, prenom, email, telephone, adresse) {
    try {
      const utilisateur = await Utilisateur.findByPk(id);

      if (!utilisateur) {
        return {
          success: false,
          message: "Utilisateur non trouvé"
        };
      }

      // NOM / PRENOM (safe update)
      if (nom !== undefined) utilisateur.nom = nom;
      if (prenom !== undefined) utilisateur.prenom = prenom;

      // EMAIL (avec exclusion utilisateur courant)
      if (email && email !== utilisateur.email) {
        const emailClean = email.trim().toLowerCase();

        const emailExist = await Utilisateur.findOne({
          where: {
            email: emailClean,
            id: { [Op.ne]: id }
          }
        });

        if (emailExist) {
          return {
            success: false,
            message: "Cet email est déjà associé à un autre compte"
          };
        }

        utilisateur.email = emailClean;
      }

      // TELEPHONE (avec exclusion utilisateur courant)
      if (telephone && telephone !== utilisateur.telephone) {
        const telExist = await Utilisateur.findOne({
          where: {
            telephone,
            id: { [Op.ne]: id }
          }
        });

        if (telExist) {
          return {
            success: false,
            message: "Ce numéro est déjà associé à un autre compte"
          };
        }

        utilisateur.telephone = telephone;
      }

      // ADRESSE
      if (adresse !== undefined) {
        utilisateur.adresse = adresse;
      }

      await utilisateur.save();

      return {
        success: true,
        message: "Profil modifié avec succès",
        utilisateur
      };

    } catch (error) {
      throw error;
    }
  }

  //oublie le password
  static async oublierPassword(email) {
    try {
      const utilisateur = await Utilisateur.findOne({ where: { email: email.trim().toLowerCase() } });

      // Email inexistant → réponse générique (sécurité)
      if (!utilisateur) {
        return { success: false, message: 'Aucun compte trouvé avec cet email' };
      }

      // Bloquer les admins
      if (utilisateur.role === 'Admin') {
        return { success: false, message: 'Action non autorisée' };
      }

      // Générer OTP 6 chiffres
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      utilisateur.otpCode = otpCode;
      utilisateur.otpExpires = otpExpires;
      await utilisateur.save();

      // Envoyer par email via Resend
      await sendOtpEmail({
        to: utilisateur.email,
        nom: `${utilisateur.prenom} ${utilisateur.nom}`,
        otp: otpCode,
      });

      return { success: true, message: 'Code envoyé par email' };
    } catch (error) {
      throw error;
    }
  }

  //reset le password
  static async resetPassword(email, otpCode, motDePasse) {
    try {
      const utilisateur = await Utilisateur.findOne({
        where: { email: email.trim().toLowerCase() }
      });

      if (!utilisateur) {
        return { success: false, message: 'Compte introuvable' };
      }

      if (!utilisateur.otpCode || utilisateur.otpCode !== otpCode) {
        return { success: false, message: 'Code incorrect' };
      }

      if (!utilisateur.otpExpires || utilisateur.otpExpires < new Date()) {
        return { success: false, message: 'Code expiré. Demandez un nouveau code.' };
      }

      if (!motDePasse || motDePasse.length < 6) {
        return { success: false, message: 'Le mot de passe doit contenir au moins 6 caractères' };
      }

      const salt = await bcrypt.genSalt(10);
      utilisateur.mot_de_passe = await bcrypt.hash(motDePasse, salt);
      utilisateur.otpCode = null;
      utilisateur.otpExpires = null;
      await utilisateur.save();

      return { success: true, message: 'Mot de passe réinitialisé avec succès' };
    } catch (error) {
      throw error;
    }
  }

}

module.exports = AuthService;
