const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { corsConfig, rateLimitConfig } = require('./config/security');

const app = express();

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


// Serveur fichiers statiques pour les uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Définition des routes
app.use('/francomaliship/auth', authRoutes);
app.use('/francomaliship/account', accountRoutes);
app.use('/francomaliship/client', envoieColisRoutes);
app.use('/francomaliship/admin', gestionUtilisateurRoutes);
app.use('/francomaliship/admin', gestionColisRoutes);

module.exports = app;
