const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const { corsConfig } = require('./config/security');
const { authenticatedRateLimit, adminRateLimit } = require('./middlewares/rateLimit.middleware');

const app = express();

// Render.com utilise un reverse proxy — nécessaire pour express-rate-limit
app.set('trust proxy', 1);

// Middlewares globaux
app.use(helmet());
app.use(cors(corsConfig));

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
// Quota par utilisateur connecté (fallback IP si non authentifié) — évite
// que des utilisateurs mobiles partageant la même IP opérateur épuisent
// ensemble un seul quota global (cause des 429 "trop d'utilisation").
app.use(authenticatedRateLimit);

// Request logger
const requestLogger = require('./middlewares/requestLogger.middleware');
app.use(requestLogger);


// Routes
const authRoutes = require('./routes/auth.route');
const accountRoutes = require('./routes/account.route');
const envoieColisRoutes = require('./routes/client/envoieColis.route');
const gestionUtilisateurRoutes = require('./routes/admin/gestionutilisateur.route');
const gestionColisRoutes = require('./routes/admin/gestioncolis.routes');
const gestionAdminRoutes = require('./routes/admin/gestionadmin.route');
const adminAuthRoutes = require('./routes/admin/adminAuth.route');
const messageClientRoutes = require('./routes/messageClient.route');
const messageClientAdminRoutes = require('./routes/admin/messageClient.admin.route');
const countryRoutes = require('./routes/admin/country.route');
const shippingPriceRoutes = require('./routes/admin/shippingPrice.route');
const shippingRateRoutes  = require('./routes/admin/shippingRate.route');
const servicePriceRoutes = require('./routes/admin/servicePrice.route');
const serviceRateRoutes  = require('./routes/admin/serviceRate.route');
const paiementRoutes        = require('./routes/admin/paiement.route');
const clientPaiementRoutes  = require('./routes/client/paiement.route');
const factureRoutes         = require('./routes/client/facture.route');
const pricingRoutes = require('./routes/pricing.route');
const trackingRoutes = require('./routes/tracking.route');
const etiquetteRoutes = require('./routes/client/etiquette.route');
const etiquetteAdminRoutes = require('./routes/admin/etiquette.route');
const reclamationClientRoutes = require('./routes/client/reclamation.route');
const reclamationAdminRoutes = require('./routes/admin/reclamation.route');
const contactRoutes = require('./routes/client/contact.route');
const preuveAdminRoutes = require('./routes/admin/preuve.route');
const preuveClientRoutes = require('./routes/client/preuve.route');
const exportRoutes = require('./routes/admin/export.route');
const avisClientRoutes = require('./routes/client/avis.route');
const avisAdminRoutes = require('./routes/admin/avis.route');
const rapportRoutes = require('./routes/admin/rapport.route');
const auditLogRoutes = require('./routes/admin/auditlog.route');

// Charge les modèles pour la sync Sequelize
require('./models/shippingRate.model');
require('./models/serviceRate.model');
require('./models/paiement.model');
require('./models/colisHistorique.model');
require('./models/reclamation.model');
require('./models/contactFavori.model');
require('./models/preuvelivraison.model');
require('./models/avis.model');
require('./models/auditlog.model');

// Jobs cron
require('./jobs/alertes.job');
require('./jobs/rapport.job');

// Serveur fichiers statiques pour les uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// SÉCURITÉ: Healthcheck pour orchestrateurs (Docker, K8s)
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK' });
});

// Compat mobile : certains écrans de l'app construisent déjà une URL de
// base finissant par /nanei puis y ajoutent un chemin qui recommence par
// /nanei/... (ex: /nanei/nanei/etiquettes/:id, /nanei/nanei/reclamations),
// ce qui donnait des 404. On normalise ce préfixe dupliqué en amont des
// routes le temps qu'une nouvelle version mobile corrige l'URL à la source.
app.use((req, res, next) => {
  if (req.url.startsWith('/nanei/nanei/')) {
    req.url = req.url.replace('/nanei/nanei/', '/nanei/');
  }
  next();
});

// Rate limit dédié sur tout le sous-arbre /nanei/admin — toutes les routes
// admin sont déjà protégées par isAdmin, mais on limite quand même le volume
// de requêtes (200 req/15min/IP), au cas où un compte admin serait compromis
// ou un script mal écrit boucle sur un endpoint.
app.use('/nanei/admin', adminRateLimit);

// Définition des routes
app.use('/nanei/auth', authRoutes);
app.use('/nanei/account', accountRoutes);
app.use('/nanei/client', envoieColisRoutes);
app.use('/nanei/admin', gestionUtilisateurRoutes);
app.use('/nanei/admin', gestionColisRoutes);
app.use('/nanei/admin', gestionAdminRoutes);
app.use('/nanei/admin', adminAuthRoutes);
app.use('/nanei/messages', messageClientRoutes);
app.use('/nanei/admin/messages', messageClientAdminRoutes);

// Pricing routes
app.use('/nanei/admin/countries', countryRoutes);
app.use('/nanei/admin/shipping-prices', shippingPriceRoutes);
app.use('/nanei/admin/shipping-rates',  shippingRateRoutes);
app.use('/nanei/admin/service-prices', servicePriceRoutes);
app.use('/nanei/admin/service-rates',  serviceRateRoutes);
app.use('/nanei/admin/paiements',      paiementRoutes);
app.use('/nanei/paiements',            clientPaiementRoutes);
app.use('/nanei/factures',             factureRoutes);
app.use('/nanei/pricing', pricingRoutes);

app.use('/nanei/suivi', trackingRoutes);
app.use('/nanei/etiquettes', etiquetteRoutes);
app.use('/nanei/admin/etiquettes', etiquetteAdminRoutes);
app.use('/nanei/reclamations', reclamationClientRoutes);
app.use('/nanei/admin/reclamations', reclamationAdminRoutes);
app.use('/nanei/contacts', contactRoutes);
app.use('/nanei/admin', preuveAdminRoutes);
app.use('/nanei', preuveClientRoutes);
app.use('/nanei/admin/export', exportRoutes);
app.use('/nanei/avis', avisClientRoutes);
app.use('/nanei/admin/avis', avisAdminRoutes);
app.use('/nanei/admin/rapports', rapportRoutes);
app.use('/nanei/admin/audit-logs', auditLogRoutes);

// Error handler (doit être après toutes les routes)
const errorHandler = require('./middlewares/errorHandler.middleware');
app.use(errorHandler);

module.exports = app;
