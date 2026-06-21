const Utilisateur = require('../models/utilisateur.model');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { jwtConfig, bcryptConfig } = require('../config/security');
const sequelize = require('../config/db');
const { uploadImage } = require('../middlewares/uploadService'); // ton upload vers Cloudinary
const crypto = require("crypto");
const { Op } = require('sequelize');
const logger = require('../config/logger');

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
      const utilisateur = await Utilisateur.findOne({ where: { email } });
      if (!utilisateur) {
        return {
          success: false,
          message: 'Utilisateur non trouvé'
        };
      }

      const token = crypto.randomBytes(32).toString("hex");
      utilisateur.resetPasswordToken = token;
      utilisateur.resetPasswordExpires = new Date(Date.now() + 3600000);
      await utilisateur.save();
      return {
        success: true,
        message: 'Token de réinitialisation de mot de passe envoyé'
      };
    } catch (error) {
      throw error;
    }
  }

  //reset le password 
  static async resetPassword(token, password) {
    try {
      const utilisateur = await Utilisateur.findOne({ where: { resetPasswordToken: token, resetPasswordExpires: { [Op.gt]: Date.now() } } });
      if (!utilisateur) {
        return {
          success: false,
          message: 'Token de réinitialisation de mot de passe invalide ou expiré'
        };
      }

      //password doit contenir au moins 8 caractères
      if (password.length < 8) {
        return {
          success: false,
          message: 'Le mot de passe doit contenir au moins 8 caractères'
        };
      }

      //password doit contenir au moins une lettre majuscule
      if (!/[A-Z]/.test(password)) {
        return {
          success: false,
          message: 'Le mot de passe doit contenir au moins une lettre majuscule'
        };
      }

      //password doit contenir au moins une lettre minuscule
      if (!/[a-z]/.test(password)) {
        return {
          success: false,
          message: 'Le mot de passe doit contenir au moins une lettre minuscule'
        };
      }

      //password doit contenir au moins un chiffre
      if (!/[0-9]/.test(password)) {
        return {
          success: false,
          message: 'Le mot de passe doit contenir au moins un chiffre'
        };
      }

      //password doit contenir au moins un caractère spécial
      if (!/[!@#$%^&*]/.test(password)) {
        return {
          success: false,
          message: 'Le mot de passe doit contenir au moins un caractère spécial'
        };
      }

      const hashedPassword = await bcrypt.hash(password, bcryptConfig.saltRounds);
      utilisateur.mot_de_passe = hashedPassword;
      utilisateur.resetPasswordToken = null;
      utilisateur.resetPasswordExpires = null;
      await utilisateur.save();
      return {
        success: true,
        message: 'Mot de passe réinitialisé avec succès'
      };
    } catch (error) {
      throw error;
    }
  }

}

module.exports = AuthService;
