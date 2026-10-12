const multer = require('multer');
const logger = require('../config/logger');

module.exports = function errorHandler(err, req, res, _next) {
  // Erreurs d'upload (multer) : ce sont des erreurs du client, pas du serveur.
  if (err instanceof multer.MulterError) {
    const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? 'Fichier trop volumineux'
      : err.code === 'LIMIT_UNEXPECTED_FILE' || err.code === 'LIMIT_FILE_COUNT'
        ? 'Trop de fichiers ou champ de fichier inattendu'
        : 'Fichier invalide';
    logger.warn('Upload refusé', { code: err.code, url: req.originalUrl, user_id: req.user?.id || null });
    return res.status(status).json({ success: false, message, error: message });
  }

  const status = err.status || err.statusCode || 500;
  logger.error('Unhandled error', {
    message: err.message,
    stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
    url: req.originalUrl,
    method: req.method,
    user_id: req.user?.id || null,
    status,
  });
  const message = status >= 500 ? 'Erreur interne du serveur' : err.message;
  res.status(status).json({ success: false, message, error: message });
};
