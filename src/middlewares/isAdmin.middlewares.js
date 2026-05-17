//est admin middleware
const isAdmin = (req, res, next) => {
    const user = req.user || req.utilisateur;
    if (!user || user.role !== 'Admin') {
        return res.status(403).json({
            success: false,
            message: 'Accès refusé'
        });
    }
    next();
};

module.exports = isAdmin;