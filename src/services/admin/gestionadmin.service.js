const { Op } = require('sequelize');
const Utilisateur = require('../../models/utilisateur.model');
const bcrypt = require('bcrypt');

class GestionAdminService {

    // ===================== LISTE ADMINS =====================
    static async listeAdmins(currentAdminId) {
        try {
            const where = { role: 'Admin' };
            // L'admin connecté ne doit pas se voir lui-même dans la liste — il
            // gère son propre compte depuis "Mon profil", pas depuis cette page.
            if (currentAdminId) {
                where.id = { [Op.ne]: currentAdminId };
            }

            const admins = await Utilisateur.findAll({ where });

            return {
                success: true,
                message: admins.length
                    ? "Liste des admins récupérée avec succès"
                    : "Aucun admin trouvé",
                data: admins
            };

        } catch (error) {
            return {
                success: false,
                message: "Erreur lors de la récupération des admins",
                error: error.message
            };
        }
    }

    // ===================== AJOUT ADMIN =====================
    static async ajouterAdmin(nom, prenom, email, mot_de_passe, telephone, adresse) {
        try {
            if (!email || !mot_de_passe) {
                return {
                    success: false,
                    message: "Email et mot de passe sont obligatoires"
                };
            }

            const emailClean = email.trim().toLowerCase();

            // Vérifier email unique
            const emailExist = await Utilisateur.findOne({
                where: { email: emailClean }
            });

            if (emailExist) {
                return {
                    success: false,
                    message: "Cet email est déjà utilisé"
                };
            }

            // Vérifier téléphone unique
            if (telephone) {
                const telExist = await Utilisateur.findOne({
                    where: { telephone }
                });

                if (telExist) {
                    return {
                        success: false,
                        message: "Ce numéro de téléphone est déjà utilisé"
                    };
                }
            }

            // validation password
            if (mot_de_passe.length < 8) {
                return {
                    success: false,
                    message: "Le mot de passe doit contenir au moins 8 caractères"
                };
            }

            const hashedPassword = await bcrypt.hash(mot_de_passe, 10);

            const utilisateur = await Utilisateur.create({
                nom,
                prenom,
                email: emailClean,
                mot_de_passe: hashedPassword,
                telephone,
                adresse,
                role: 'Admin',
                statut: 'actif'
            });

            return {
                success: true,
                message: "Admin créé avec succès",
                data: utilisateur
            };

        } catch (error) {
            return {
                success: false,
                message: "Erreur lors de la création de l'admin",
                error: error.message
            };
        }
    }

    // ===================== ACTIVER ADMIN =====================
    static async activerAdmin(id) {
        try {
            const utilisateur = await Utilisateur.findByPk(id);

            if (!utilisateur) {
                return {
                    success: false,
                    message: "Admin introuvable"
                };
            }

            utilisateur.statut = 'actif';
            await utilisateur.save();

            return {
                success: true,
                message: "Admin activé avec succès",
                data: utilisateur
            };

        } catch (error) {
            return {
                success: false,
                message: "Erreur lors de l'activation",
                error: error.message
            };
        }
    }

    // ===================== DÉSACTIVER ADMIN =====================
    static async desactiverAdmin(id) {
        try {
            const utilisateur = await Utilisateur.findByPk(id);

            if (!utilisateur) {
                return {
                    success: false,
                    message: "Admin introuvable"
                };
            }

            utilisateur.statut = 'inactif';
            await utilisateur.save();

            return {
                success: true,
                message: "Admin désactivé avec succès",
                data: utilisateur
            };

        } catch (error) {
            return {
                success: false,
                message: "Erreur lors de la désactivation",
                error: error.message
            };
        }
    }

    // ===================== NOMBRE ADMINS =====================
    static async nombreAdmins() {
        try {
            const total = await Utilisateur.count({
                where: { role: 'Admin' }
            });

            return {
                success: true,
                data: total
            };

        } catch (error) {
            return {
                success: false,
                message: "Erreur lors du comptage des admins",
                error: error.message
            };
        }
    }

    // ===================== RECHERCHER ADMIN =====================
    static async rechercherAdmin({ nom, prenom, email }) {
        try {
            const where = { role: 'Admin' };

            if (nom) where.nom = { [Op.like]: `%${nom}%` };
            if (prenom) where.prenom = { [Op.like]: `%${prenom}%` };
            if (email) where.email = { [Op.like]: `%${email}%` };

            const admins = await Utilisateur.findAll({
                where,
                attributes: { exclude: ['mot_de_passe'] },
                order: [['created_at', 'DESC']]
            });

            return admins;

        } catch (error) {
            return {
                success: false,
                message: "Erreur lors de la recherche des admins",
                error: error.message
            };
        }
    }
}

module.exports = GestionAdminService;