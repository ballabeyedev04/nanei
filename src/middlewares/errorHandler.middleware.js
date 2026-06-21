const logger = require('../config/logger');

module.exports = function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;
  logger.error('Unhandled error', {
    message: err.message,
    stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
    url: req.originalUrl,
    method: req.method,
    user_id: req.user?.id || null,
    status,
  });
  res.status(status).json({
    error: status >= 500 ? 'Erreur interne du serveur' : err.message,
  });
};
