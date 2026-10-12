const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const {
  authRateLimitConfig,
  authenticatedRateLimitConfig,
  mutationRateLimitConfig,
  adminRateLimitConfig,
  otpEmailRateLimitConfig,
  suiviPublicRateLimitConfig,
  jwtConfig,
} = require('../config/security');

// Connexion — 5 tentatives / 15 min par IP (anti force brute).
const authRateLimit = rateLimit(authRateLimitConfig);

// Compteurs SÉPARÉS : avant, une seule instance (5 / 15 min / IP) était
// partagée par login, refresh et mots de passe oubliés. Quelques
// renouvellements de session suffisaient à bloquer la connexion des autres
// utilisateurs derrière la même IP (NAT opérateur, bureau).
// Renouvellement de session : un refresh token valide est déjà requis.
const refreshRateLimit = rateLimit({
  ...authRateLimitConfig,
  max: 30,
  message: { message: 'Trop de renouvellements de session. Veuillez réessayer dans quelques minutes.' },
});

// Mot de passe oublié / réinitialisation (mobile et admin) — 5 / 15 min par IP.
const motDePasseRateLimit = rateLimit(authRateLimitConfig);

// Mutations sensibles (modifier profil, changer mdp, supprimer compte) — 20 req / 15 min par IP
const mutationRateLimit = rateLimit(mutationRateLimitConfig);

// Routes admin — 200 req / 15 min par IP
const adminRateLimit = rateLimit(adminRateLimitConfig);

// OTP mot de passe oublié par EMAIL — 3 req / 15 min par email ciblé (anti multi-IP)
// keyGenerator : normalise l'email reçu dans le body pour construire la clé de comptage
const otpEmailRateLimit = rateLimit({
  ...otpEmailRateLimitConfig,
  keyGenerator: (req, res) => {
    const email = (req.body?.email || '').trim().toLowerCase();
    return email || ipKeyGenerator(req, res);
  },
  skip: (req) => {
    // Ne s'applique pas si le body est vide (le validate Joi rejettera la requête après)
    return !req.body?.email;
  },
});

// Quota par UTILISATEUR (pas par IP) pour les requêtes authentifiées — évite
// que plusieurs utilisateurs mobiles derrière la même IP opérateur (NAT)
// épuisent ensemble un seul quota global et se prennent des 429 à tort.
// On décode le JWT directement ici (sans dépendre de authMiddleware, qui
// tourne après ce middleware global) : si le token est absent/invalide, on
// retombe sur l'IP — même comportement que pour un visiteur non connecté.
const authenticatedRateLimit = rateLimit({
  ...authenticatedRateLimitConfig,
  keyGenerator: (req, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const decoded = jwt.verify(authHeader.split(' ')[1], jwtConfig.secret);
        if (decoded?.id) return `user:${decoded.id}`;
      } catch (_) {
        // token invalide/expiré — fallback IP, authMiddleware renverra 401 ensuite
      }
    }
    return ipKeyGenerator(req, res);
  },
});

// Suivi public d'un colis — 30 req / 15 min par IP (anti énumération de références)
const suiviPublicRateLimit = rateLimit(suiviPublicRateLimitConfig);

module.exports = {
  authRateLimit,
  refreshRateLimit,
  motDePasseRateLimit,
  authenticatedRateLimit,
  mutationRateLimit,
  adminRateLimit,
  otpEmailRateLimit,
  suiviPublicRateLimit,
};
