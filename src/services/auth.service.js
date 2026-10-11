const Utilisateur = require('../models/utilisateur.model');
const RefreshToken = require('../models/refreshToken.model');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const { jwtConfig, bcryptConfig } = require('../config/security');
const sequelize = require('../config/db');
const crypto = require("crypto");
const logger = require('../config/logger');
const { sendOtpEmail } = require('./resend.service');

class AuthService {

  // 🔹 Génère un refresh token (JWT longue durée) et enregistre son hash
  // SHA-256 en base (table refresh_tokens). Le token brut n'est jamais
  // stocké — une fuite DB ne compromet donc pas les sessions actives.
  static async genererRefreshToken(utilisateur) {
    const refreshToken = jwt.sign(
      { id: utilisateur.id, role: utilisateur.role },
      jwtConfig.refreshSecret,
      { expiresIn: jwtConfig.refreshExpiresIn }
    );

    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const { exp } = jwt.decode(refreshToken);

    await RefreshToken.create({
      tokenHash,
      utilisateurId: utilisateur.id,
      expiresAt: new Date(exp * 1000),
      revoked: false,
    });

    return refreshToken;
  }

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
      // Normaliser le téléphone : si falsy, le passer comme null pour éviter les valeurs undefined
      const tel = telephone || null;

      const hashedPassword = await bcrypt.hash(
        mot_de_passe,
        bcryptConfig.saltRounds
      );

      // 🔹 Revendication d'un compte "destinataire" créé automatiquement lors
      // d'un envoi de colis (statut 'inactif'). Si un tel compte correspond à
      // l'email OU au téléphone fourni ici, on le complète et on l'active au
      // lieu d'en créer un nouveau : la personne retrouve ainsi les colis déjà
      // reçus sous ce compte.
      const compteFantome = await Utilisateur.findOne({
        where: {
          statut: 'inactif',
          role: 'Particulier',
          [Op.or]: [
            { email: emailClean },
            ...(tel ? [{ telephone: tel }] : []),
          ],
        },
        transaction: t,
      });

      if (compteFantome) {
        // Vérifier qu'un autre compte ACTIF ne possède pas déjà cet email / ce
        // téléphone (collision impossible à résoudre par une revendication).
        const collision = await Utilisateur.findOne({
          where: {
            id: { [Op.ne]: compteFantome.id },
            [Op.or]: [
              { email: emailClean },
              ...(tel ? [{ telephone: tel }] : []),
            ],
          },
          transaction: t,
        });
        if (collision) {
          await t.rollback();
          return {
            success: false,
            message: collision.email === emailClean
              ? "Cet email est déjà utilisé"
              : "Ce numéro de téléphone est déjà utilisé",
          };
        }

        compteFantome.nom = nom;
        compteFantome.prenom = prenom;
        compteFantome.email = emailClean;
        compteFantome.mot_de_passe = hashedPassword;
        compteFantome.adresse = adresse;
        compteFantome.telephone = tel;
        compteFantome.role = role;
        compteFantome.statut = 'actif';
        compteFantome.passwordChangedAt = new Date();
        await compteFantome.save({ transaction: t });

        await t.commit();
        logger.info('Compte destinataire revendiqué à l\'inscription', { user_id: compteFantome.id });
        return {
          success: true,
          message: "Inscription réussie",
          utilisateur: compteFantome,
        };
      }

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


  // 🔹 Retrouve un utilisateur à partir d'un numéro saisi librement.
  // Les numéros sont enregistrés au format international (« +22376000000 »,
  // saisi via le sélecteur de pays de l'app), mais l'utilisateur tape souvent
  // son numéro local (« 76 00 00 00 », « 0612345678 ») ou « 00223… ».
  //  1. correspondance exacte (comportement historique) ;
  //  2. correspondance sur les chiffres seuls ;
  //  3. le numéro enregistré SE TERMINE par le numéro saisi (sans 0 initial),
  //     à condition qu'il n'y ait qu'un seul compte possible (sinon ambigu →
  //     on refuse plutôt que de connecter la mauvaise personne).
  static async trouverParTelephone(saisie) {
    const brut = String(saisie || '').trim();
    if (!brut) return null;

    const exact = await Utilisateur.findOne({ where: { telephone: brut } });
    if (exact) return exact;

    let chiffres = brut.replace(/\D/g, '');
    if (chiffres.startsWith('00')) chiffres = chiffres.slice(2);
    if (chiffres.length < 7) return null;

    const telNormalise = sequelize.fn('regexp_replace', sequelize.col('telephone'), '[^0-9]', '', 'g');

    const memesChiffres = await Utilisateur.findAll({
      where: sequelize.where(telNormalise, chiffres),
      limit: 2,
    });
    if (memesChiffres.length === 1) return memesChiffres[0];

    const local = chiffres.replace(/^0+/, '');
    if (local.length < 7) return null;
    const candidats = await Utilisateur.findAll({
      where: sequelize.where(telNormalise, { [Op.like]: `%${local}` }),
      limit: 5,
    });
    if (candidats.length === 1) return candidats[0];
    const actifs = candidats.filter((u) => u.statut === 'actif');
    if (actifs.length === 1) return actifs[0];
    if (candidats.length > 1) {
      logger.warn('Connexion par téléphone ambiguë', { nb_comptes: candidats.length });
    }
    return null;
  }

  // -------------------- CONNEXION --------------------
  static async login({ identifiant, mot_de_passe }) {
    const isEmail = /\S+@\S+\.\S+/.test(identifiant);
    const utilisateur = isEmail
      ? await Utilisateur.findOne({ where: { email: identifiant.trim().toLowerCase() } })
      : await this.trouverParTelephone(identifiant);

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

    const refreshToken = await this.genererRefreshToken(utilisateur);

    return { success: true, token, refreshToken, utilisateur };
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

      // Envoyer par email via Resend.
      //
      // Isolé dans son propre try : le bloc englobant transforme TOUTE erreur
      // en « Impossible d'envoyer l'email », y compris une panne de base au
      // moment d'écrire l'OTP. Les deux causes se confondaient donc dans les
      // logs, alors qu'elles n'appellent pas du tout la même correction.
      try {
        await sendOtpEmail({
          to: utilisateur.email,
          nom: `${utilisateur.prenom} ${utilisateur.nom}`,
          otp: otpCode,
        });
      } catch (erreurMail) {
        logger.error('Envoi OTP impossible — vérifier RESEND_API_KEY et le domaine de MAIL_FROM', {
          error: erreurMail.message,
        });
        throw erreurMail;
      }

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
