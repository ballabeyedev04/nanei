// Création de l'admin par défaut au 1er démarrage, si absent.
// Identifiants pilotés par .env (ADMIN_EMAIL/ADMIN_PASSWORD/...) — jamais
// codés en dur, sinon le compte réellement créé ne correspond pas à ce que
// l'opérateur configure et s'attend à utiliser pour se connecter.
const bcrypt = require("bcrypt");
const { Utilisateur } = require("../models");
const { bcryptConfig } = require("../config/security");
const logger = require("../config/logger");

const seedAdmin = async () => {
    try {
        const adminEmail = process.env.ADMIN_EMAIL;
        const adminPassword = process.env.ADMIN_PASSWORD;

        if (!adminEmail || !adminPassword) {
            logger.error("Seed admin impossible : ADMIN_EMAIL / ADMIN_PASSWORD manquants dans .env");
            return;
        }

        const exist = await Utilisateur.findOne({ where: { email: adminEmail } });
        if (exist) {
            logger.info("Admin déjà existant, seed ignoré");
            return;
        }

        const hashedPassword = await bcrypt.hash(adminPassword, bcryptConfig.saltRounds);

        await Utilisateur.create({
            nom: process.env.ADMIN_NOM || "Admin",
            prenom: process.env.ADMIN_PRENOM || "Nanei",
            email: adminEmail,
            mot_de_passe: hashedPassword,
            adresse: process.env.ADMIN_ADRESSE || "Dakar, Sénégal",
            role: "Admin",
            statut: "actif"
        });

        logger.info(`Admin créé avec succès : ${adminEmail}`);

    } catch (error) {
        logger.error("Erreur seed admin", { error: error.message, stack: error.stack });
    }
};

module.exports = seedAdmin;