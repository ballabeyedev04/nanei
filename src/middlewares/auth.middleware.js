const jwt = require('jsonwebtoken');
const { jwtConfig } = require('../config/security');
const User = require('../models/utilisateur.model');
const logger = require('../config/logger');

const authMiddleware = async (req, res, next) => {
  try {
    // Vérifier que le header Authorization est présent
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn('Token manquant ou invalide', { ip: req.ip, url: req.originalUrl });
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

    // Vérifier que le compte est actif — un compte désactivé ne peut plus accéder à l'API
    // même si son JWT est encore valide (jusqu'à expiration)
    if (utilisateur.statut !== 'actif') {
      logger.warn('Accès refusé — compte désactivé', { user_id: utilisateur.id, ip: req.ip, url: req.originalUrl });
      return res.status(403).json({ message: 'Compte désactivé. Contactez le support.' });
    }

    // Invalider tout token émis AVANT le dernier changement de mot de passe —
    // équivalent d'une révocation de session en l'absence de table de tokens.
    if (
      utilisateur.passwordChangedAt &&
      decoded.iat * 1000 < utilisateur.passwordChangedAt.getTime()
    ) {
      logger.warn('Accès refusé — token émis avant le dernier changement de mot de passe', {
        user_id: utilisateur.id, ip: req.ip, url: req.originalUrl
      });
      return res.status(401).json({ message: 'Session expirée suite à un changement de mot de passe. Veuillez vous reconnecter.' });
    }

    // Ajouter l'utilisateur à la requête pour les prochains middlewares / contrôleurs
    req.user = utilisateur;

    // Passer au prochain middleware ou route
    next();
  } catch (err) {
    logger.warn('Token invalide', { ip: req.ip, url: req.originalUrl, error: err.message });
    return res.status(401).json({ message: 'Token invalide' });
  }
};

module.exports = authMiddleware;
