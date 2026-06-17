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
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(rateLimit(rateLimitConfig));


// Routes
const authRoutes = require('./routes/auth.route');
const accountRoutes = require('./routes/account.route');
const envoieColisRoutes = require('./routes/client/envoieColis.route');
const gestionUtilisateurRoutes = require('./routes/admin/gestionutilisateur.route');
const gestionColisRoutes = require('./routes/admin/gestioncolis.routes');
const gestionAdminRoutes = require('./routes/admin/gestionadmin.route');
const messageClientRoutes = require('./routes/messageClient.route');
const messageClientAdminRoutes = require('./routes/admin/messageClient.admin.route');
const countryRoutes = require('./routes/admin/country.route');
const shippingPriceRoutes = require('./routes/admin/shippingPrice.route');
const servicePriceRoutes = require('./routes/admin/servicePrice.route');
const pricingRoutes = require('./routes/pricing.route');

// Serveur fichiers statiques pour les uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Définition des routes
app.use('/nanei/auth', authRoutes);
app.use('/nanei/account', accountRoutes);
app.use('/nanei/client', envoieColisRoutes);
app.use('/nanei/admin', gestionUtilisateurRoutes);
app.use('/nanei/admin', gestionColisRoutes);
app.use('/nanei/admin', gestionAdminRoutes);
app.use('/nanei/messages', messageClientRoutes);
app.use('/nanei/admin/messages', messageClientAdminRoutes);

// Pricing routes
app.use('/nanei/admin/countries', countryRoutes);
app.use('/nanei/admin/shipping-prices', shippingPriceRoutes);
app.use('/nanei/admin/service-prices', servicePriceRoutes);
app.use('/nanei/pricing', pricingRoutes);

module.exports = app;
