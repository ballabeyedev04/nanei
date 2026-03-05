const jwt = require('jsonwebtoken');
const { jwtConfig } = require('../config/security');
const User = require('../models/utilisateur.model');

const authMiddleware = async (req, res, next) => {
  try {
    // Vérifier que le header Authorization est présent
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Token manquant ou invalide' });
    }

    // Extraire le token
    const token = authHeader.split(' ')[1];

    // Vérifier et décoder le token
    const decoded = jwt.verify(token, jwtConfig.secret);

    // Vérifier que l'utilisateur existe en base
    const utilisateur = await User.findByPk(decoded.id);
    if (!utilisateur) {
      return res.status(404).json({ message: 'Utilisateur introuvable' });
    }

    // Ajouter l'utilisateur à la requête pour les prochains middlewares / contrôleurs
    req.user = utilisateur;

    // Passer au prochain middleware ou route
    next();
  } catch (err) {
    console.error('Erreur middleware auth:', err);
    return res.status(401).json({ message: 'Token invalide', erreur: err.message });
  }
};

module.exports = authMiddleware;
