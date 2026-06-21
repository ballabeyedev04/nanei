require('dotenv').config();
const sequelize = require('./config/db');
const app = require('./app');
const logger = require('./config/logger');

// Modèles
const User = require('./models/utilisateur.model');
const Colis = require('./models/colis.model');
const Notification = require('./models/notification.model');
const MessageClient = require('./models/messageClient.model');
const seedAdmin = require("./seed/seedAdmin");


(async () => {
  try {
    // Synchronisation DB
    await sequelize.sync({ alter: true });

    // creation admin
    await seedAdmin();
    logger.info('Base synchronisée avec succès');

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, '0.0.0.0', () => {
      logger.info(`Serveur lancé sur le port ${PORT}`);
    });
  } catch (err) {
    logger.error('Erreur lors de la synchronisation de la base', { error: err.message, stack: err.stack });
  }
})();
