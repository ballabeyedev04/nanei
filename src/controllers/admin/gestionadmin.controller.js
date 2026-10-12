const GestionAdminService = require('../../services/admin/gestionadmin.service');
const { statutEchec } = require('../../utils/statutHttp');

// ===================== LISTE ADMINS =====================
exports.listeAdmins = async (req, res) => {
    try {
        const result = await GestionAdminService.listeAdmins(req.user.id, req.query);

        // Erreur base : 500 (avant : 200 avec success: false)
        if (result && result.success === false) return res.status(500).json(result);
        return res.status(200).json(result);

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Erreur serveur lors de la récupération des admins",
            error: error.message
        });
    }
};

// ===================== AJOUT ADMIN =====================
exports.ajouterAdmin = async (req, res) => {
    try {
        const { nom, prenom, email, mot_de_passe, telephone, adresse } = req.body;

        const result = await GestionAdminService.ajouterAdmin(
            nom,
            prenom,
            email,
            mot_de_passe,
            telephone,
            adresse
        );

        if (!result.success) {
            return res.status(statutEchec(result, 400)).json(result);
        }

        return res.status(201).json(result);

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Erreur serveur lors de l'ajout de l'admin",
            error: error.message
        });
    }
};

// ===================== ACTIVER ADMIN =====================
exports.activerAdmin = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await GestionAdminService.activerAdmin(id);

        if (!result.success) {
            const { status = 404, ...corps } = result;
            return res.status(status).json(corps);
        }

        return res.status(200).json(result);

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Erreur serveur lors de l'activation",
            error: error.message
        });
    }
};

// ===================== DÉSACTIVER ADMIN =====================
exports.desactiverAdmin = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await GestionAdminService.desactiverAdmin(id, req.user?.id);

        if (!result.success) {
            const { status = 404, ...corps } = result;
            return res.status(status).json(corps);
        }

        return res.status(200).json(result);

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Erreur serveur lors de la désactivation",
            error: error.message
        });
    }
};

// ===================== NOMBRE ADMINS =====================
exports.nombreAdmins = async (req, res) => {
    try {
        const result = await GestionAdminService.nombreAdmins();

        // Erreur base : 500 (avant : 200 avec success: false)
        if (result && result.success === false) return res.status(500).json(result);
        return res.status(200).json(result);

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Erreur serveur lors du comptage",
            error: error.message
        });
    }
};

// ===================== RECHERCHER ADMIN =====================
exports.rechercherAdmin = async (req, res) => {
    try {
        const { nom, prenom, email } = req.query;

        const result = await GestionAdminService.rechercherAdmin({ nom, prenom, email });

        // Erreur base : 500 (avant : 200 avec success: false)
        if (result && result.success === false) return res.status(500).json(result);
        return res.status(200).json(result);

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Erreur serveur lors de la recherche",
            error: error.message
        });
    }
};