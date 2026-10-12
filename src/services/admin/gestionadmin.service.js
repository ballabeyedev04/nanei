const { Op } = require('sequelize');
const { paginer, motifRecherche, avecPagination } = require('../../utils/pagination');
const Utilisateur = require('../../models/utilisateur.model');
const bcrypt = require('bcrypt');
const {
    email: emailSchema, motDePasse: motDePasseSchema, nom: nomSchema, prenom: prenomSchema, telephone: telephoneSchema,
} = require('../../validations/common');

class GestionAdminService {

    // ===================== LISTE ADMINS =====================
    // Query : page, limit (pagination facultative), q (nom, prénom, e-mail, téléphone)
    static async listeAdmins(currentAdminId, query = {}) {
        try {
            const motif = motifRecherche(query.q);
            const where = { role: 'Admin', ...(motif ? { [Op.or]: [
                { nom: { [Op.iLike]: motif } },
                { prenom: { [Op.iLike]: motif } },
                { email: { [Op.iLike]: motif } },
                { telephone: { [Op.iLike]: motif } },
            ] } : {}) };
            // L'admin connecté ne doit pas se voir lui-même dans la liste — il
            // gère son propre compte depuis "Mon profil", pas depuis cette page.
            if (currentAdminId) {
                where.id = { [Op.ne]: currentAdminId };
            }

            const { lignes: admins, pagination } = await paginer(Utilisateur, {
                where,
                attributes: { exclude: Utilisateur.CHAMPS_PRIVES },
                order: [['created_at', 'DESC']],
            }, query);

            return avecPagination({
                success: true,
                message: admins.length
                    ? "Liste des admins récupérée avec succès"
                    : "Aucun admin trouvé",
                data: admins
            }, pagination);

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

            const emailClean = String(email).trim().toLowerCase();
            const { error: erreurEmail } = emailSchema.validate(emailClean);
            if (erreurEmail) {
                return { success: false, message: "Adresse e-mail invalide" };
            }
            if (!nom || !String(nom).trim() || !prenom || !String(prenom).trim()) {
                return { success: false, message: "Le nom et le prénom sont obligatoires" };
            }
            // Mêmes règles qu'à l'inscription (validations/common.js) : 2 à 50
            // caractères pour le nom et le prénom, format de téléphone.
            nom = String(nom).trim();
            prenom = String(prenom).trim();
            if (nomSchema.validate(nom).error || prenomSchema.validate(prenom).error) {
                return { success: false, message: "Le nom et le prénom doivent contenir entre 2 et 50 caractères" };
            }
            // Téléphone vide → NULL : la colonne est UNIQUE, et "" enregistré
            // tel quel faisait échouer la création du 2e admin sans téléphone.
            telephone = telephone && String(telephone).trim() ? String(telephone).trim() : null;
            if (telephone && telephoneSchema.validate(telephone).error) {
                return { success: false, message: "Numéro de téléphone invalide" };
            }
            adresse = adresse ? String(adresse).trim() : '';

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

            // Même règle que l'inscription et le changement de mot de passe
            // (avant : 8 caractères seulement, sans autre exigence).
            const { error: erreurMdp } = motDePasseSchema.validate(mot_de_passe);
            if (erreurMdp) {
                return {
                    success: false,
                    message: "Le mot de passe doit contenir au moins 8 caractères, une majuscule, une minuscule et un chiffre"
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

            // Seuls les comptes Admin passent par cette route (les clients :
            // PATCH /admin/activer-utilisateurs/:id).
            if (!utilisateur || utilisateur.role !== 'Admin') {
                return {
                    success: false,
                    status: 404,
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
                status: 500,
                message: "Erreur lors de l'activation"
            };
        }
    }

    // ===================== DÉSACTIVER ADMIN =====================
    static async desactiverAdmin(id, currentAdminId) {
        try {
            const utilisateur = await Utilisateur.findByPk(id);

            if (!utilisateur || utilisateur.role !== 'Admin') {
                return {
                    success: false,
                    status: 404,
                    message: "Admin introuvable"
                };
            }

            // Garde-fous : un admin ne peut pas se désactiver lui-même, et le
            // dernier admin actif ne peut pas être désactivé (sinon plus
            // personne ne peut accéder au back-office).
            if (currentAdminId && String(utilisateur.id) === String(currentAdminId)) {
                return {
                    success: false,
                    status: 400,
                    message: "Vous ne pouvez pas désactiver votre propre compte"
                };
            }
            if (utilisateur.statut === 'actif') {
                const autresAdminsActifs = await Utilisateur.count({
                    where: { role: 'Admin', statut: 'actif', id: { [Op.ne]: utilisateur.id } }
                });
                if (autresAdminsActifs === 0) {
                    return {
                        success: false,
                        status: 400,
                        message: "Impossible de désactiver le dernier administrateur actif"
                    };
                }
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
                status: 500,
                message: "Erreur lors de la désactivation"
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
            // Insensible à la casse, % et _ saisis pris littéralement (avant :
            // LIKE brut, « dupont » ne trouvait pas « Dupont »).
            const where = { role: 'Admin' };

            if (motifRecherche(nom)) where.nom = { [Op.iLike]: motifRecherche(nom) };
            if (motifRecherche(prenom)) where.prenom = { [Op.iLike]: motifRecherche(prenom) };
            if (motifRecherche(email)) where.email = { [Op.iLike]: motifRecherche(email) };

            const admins = await Utilisateur.findAll({
                where,
                attributes: { exclude: Utilisateur.CHAMPS_PRIVES },
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