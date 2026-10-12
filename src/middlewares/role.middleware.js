/**
 * Garde de rôle générique (à placer APRÈS auth.middleware, qui remplit
 * req.user depuis la base).
 *
 * Avant : le module exportait aussi un `authMiddleware` jamais défini dans ce
 * fichier (ReferenceError au premier `require`) et importait des modules
 * inutiles. L'authentification se fait par middlewares/auth.middleware.js.
 */
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

module.exports = { roleMiddleware };
