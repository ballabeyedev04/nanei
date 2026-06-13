const rateLimit = require('express-rate-limit');
const { authRateLimitConfig } = require('../config/security');

const authRateLimit = rateLimit(authRateLimitConfig);

module.exports = { authRateLimit };
