const logger = require('../config/logger');

module.exports = function requestLogger(req, res, next) {
  const start = Date.now();
  const { method, originalUrl, ip } = req;
  // Exclure les routes de health check
  if (originalUrl === '/health' || originalUrl === '/') return next();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const level = res.statusCode >= 500 ? 'error'
                : res.statusCode >= 400 ? 'warn'
                : 'info';
    logger[level](`${method} ${originalUrl} ${res.statusCode} ${duration}ms`, {
      method, url: originalUrl,
      status: res.statusCode,
      duration_ms: duration,
      ip: req.ip || ip,
      user_id: req.user?.id || null,
    });
  });
  next();
};
