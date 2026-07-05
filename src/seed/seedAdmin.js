//creation admin automatiquement 
const bcrypt = require("bcrypt");
const { Utilisateur } = require("../models"); // adapte le chemin

const seedAdmin = async () => {
    try {
        const adminEmail = "admin@gmail.com";

        // 1. Vérifier si admin existe déjà
        const exist = await Utilisateur.findOne({
            where: { email: adminEmail }
        });

        if (exist) {
            console.log("👤 Admin déjà existant");
            return;
        }

        // 2. Créer admin
        const hashedPassword = await bcrypt.hash("Passer123", 10);

        await Utilisateur.create({
            nom: "Admin",
            prenom: "Admin",
            email: adminEmail,
            mot_de_passe: hashedPassword,
            adresse: "Dakar, Sénégal",
            telephone: "+2217734444",
            role: "Admin"
        });

        console.log("✅ Admin créé avec succès");

    } catch (error) {
        console.error("❌ Erreur seed admin :", error.message);
    }
};

module.exports = seedAdmin;