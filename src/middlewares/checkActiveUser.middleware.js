const checkActiveUser = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Utilisateur non authentifié' });
  }

  if (req.user.statut !== 'actif') {
    return res.status(403).json({
      message: 'Votre compte est désactivé. Veuillez contacter le support ou réactiver votre compte.',
      statut: req.user.statut
    });
  }

  next();
};

module.exports = checkActiveUser;
