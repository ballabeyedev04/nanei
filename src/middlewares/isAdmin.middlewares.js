//est admin middleware
const isAdmin = (req, res, next) => {
    if (req.utilisateur.role !== 'Admin') {
        return res.status(403).json({
            success: false,
            message: 'Accès refusé'
        });
    }
    next();
};

module.exports = isAdmin;