const Utilisateur = require('../models/utilisateur.model');
const bcrypt = require('bcryptjs');
const sequelize = require('../config/db');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { jwtConfig } = require('../config/security');
const { sendEmail } = require('../utils/mailer');
const resetPasswordTemplate = require('../templates/mail/resetPassword.template');


class AccountService {

  // -------------------- MOT DE PASSE OUBLIÉ --------------------
  static async forgotPassword(email) {
    try {
      const utilisateur = await Utilisateur.findOne({ where: { email } });
      if (!utilisateur) {
        return { error: "Aucun compte trouvé avec cet email." };
      }

      //Générer un token temporaire pour réinitialisation (valide 1h)
      const resetToken = jwt.sign(
        { id: utilisateur.id },
        jwtConfig.secret,
        { expiresIn: '1h' }
      );

      //Construire le lien de réinitialisation (frontend)
      const resetLink = `${process.env.FRONTEND_URL}/account/reset-password?token=${resetToken}`;

      //Configurer Nodemailer (SMTP ou Gmail)
      const html = resetPasswordTemplate({
            nom: utilisateur.nom,
            resetLink
        });

      //Envoyer l'email
      await sendEmail({
        to: email,
        subject: "Réinitialisation de votre mot de passe",
        html
    });

      return { message: "Email de réinitialisation envoyé. Vérifiez votre boîte mail."};

    } catch (error) {
      console.error('Erreur forgotPassword:', error);
      throw error;
    }
  }

  // -------------------- CHANGER MOT DE PASSE --------------------
  static async changePassword(userId, oldPassword, newPassword) {
    try {
      // 1️⃣ Vérifier si l'utilisateur existe
      const utilisateur = await Utilisateur.findByPk(userId);
      if (!utilisateur) {
        return { error: "Utilisateur non trouvé." };
      }

      // 2️⃣ Vérifier l'ancien mot de passe
      const isMatch = await bcrypt.compare(oldPassword, utilisateur.mot_de_passe);
      if (!isMatch) {
        return { error: "Mot de passe actuel incorrect." };
      }

      // 3️⃣ Vérifier la complexité du nouveau mot de passe
      if (newPassword.length < 8) {
        return { error: "Le mot de passe doit contenir au moins 8 caractères." };
      }

      // 4️⃣ Hasher le nouveau mot de passe
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);

      // 5️⃣ Mettre à jour le mot de passe
      utilisateur.mot_de_passe = hashedPassword;
      await utilisateur.save();

      return {
        message: "Mot de passe modifié avec succès."
      };

    } catch (error) {
      console.error("Erreur changePassword:", error);
      throw error;
    }
  }

  // Modifier informations personnelles
  static async updateProfile({ userId, data }) {
    const { nom, prenom, email, telephone, adresse, photoProfil, carte_identite_national_num} = data;

        const t = await sequelize.transaction();
        try {
            const utilisateur = await Utilisateur.findByPk(userId, { transaction: t });
            if (!utilisateur) {
                await t.rollback();
                return { error: "Utilisateur non trouvé" };
            }

            // Vérification email
            if (email && email !== utilisateur.email) {
                const existEmail = await Utilisateur.findOne({
                    where: { email },
                    transaction: t
            });
            if (existEmail) {
                await t.rollback();
                return { error: "Cet email est déjà utilisé" };
            }
            utilisateur.email = email;
            }

            // Vérification téléphone
            if (telephone && telephone !== utilisateur.telephone) {
            const existTel = await Utilisateur.findOne({
                where: { telephone },
                transaction: t
            });
            if (existTel) {
                await t.rollback();
                return { error: "Ce numéro de téléphone est déjà utilisé" };
            }
            utilisateur.telephone = telephone;
            }

            // Vérification CIN
            if (carte_identite_national_num && carte_identite_national_num !== utilisateur.carte_identite_national_num) {
            const existCIN = await Utilisateur.findOne({
                where: { carte_identite_national_num },
                transaction: t
            });
            if (existCIN) {
                await t.rollback();
                return { error: "Le numéro CIN est déjà utilisé" };
            }
            utilisateur.carte_identite_national_num = carte_identite_national_num;
            }

            if (nom) utilisateur.nom = nom;
            if (prenom) utilisateur.prenom = prenom;
            if (adresse !== undefined) utilisateur.adresse = adresse;
            if (photoProfil) utilisateur.photoProfil = photoProfil;
            if (carte_identite_national_num) utilisateur.carte_identite_national_num = carte_identite_national_num;

            await utilisateur.save({ transaction: t });
            await t.commit();

            return {
                message: "Profil modifié avec succès",
                utilisateur
            };

        } catch (error) {
            await t.rollback();
            throw error;
        }
  }

}

module.exports = AccountService;
