const Utilisateur = require('../models/utilisateur.model');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { jwtConfig, bcryptConfig } = require('../config/security');
const sequelize = require('../config/db');
const { uploadImage } = require('../middlewares/uploadService'); // ton upload vers Cloudinary


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

      if (telephone) {
        const telExist = await Utilisateur.findOne({
          where: { telephone },
          transaction: t
        });

        if (telExist) {
          await t.rollback();
          return {
            success: false,
            message: "Ce numéro de téléphone est déjà utilisé"
          };
        }
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
        telephone,
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
      where: isEmail ? { email: identifiant } : { telephone: identifiant },
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

}

module.exports = AuthService;
