const jwt = require('jsonwebtoken');
const { jwtConfig } = require('../config/security');
const { User: Utilisateur } = require('../models');

const roleMiddleware = (roles = []) => {
  if (typeof roles === 'string') roles = [roles];

  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Utilisateur non authentifié' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Accès refusé: rôle non autorisé' });
    }
    next();
  };
};

module.exports = { authMiddleware, roleMiddleware };
