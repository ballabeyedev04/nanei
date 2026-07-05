const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { corsConfig, rateLimitConfig } = require('./config/security');

const app = express();

// Render.com utilise un reverse proxy — nécessaire pour express-rate-limit
app.set('trust proxy', 1);

// Middlewares globaux
app.use(helmet());
app.use(cors(corsConfig));

// SÉCURITÉ: Capturer le body brut pour validation signature webhook
app.use((req, res, next) => {
  let data = '';
  req.on('data', chunk => data += chunk);
  req.on('end', () => {
    req.rawBody = data;
    next();
  });
});

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(rateLimit(rateLimitConfig));

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
