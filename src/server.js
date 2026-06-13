require('dotenv').config();
const sequelize = require('./config/db');
const app = require('./app');

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
    console.log('✅ Base synchronisée avec succès');

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Serveur lancé sur le port ${PORT}`);
    });
  } catch (err) {
    console.error('❌ Erreur lors de la synchronisation de la base :', err);
  }
})();
