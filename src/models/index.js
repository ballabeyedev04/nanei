// models/index.js
const Utilisateur = require('./utilisateur.model');
const Colis = require('./colis.model');
const Notifications = require('./notification.model');
const MessageClient = require('./messageClient.model');

// 🔹 Associations Colis
Utilisateur.hasMany(Colis, { foreignKey: 'expediteurId', as: 'colisEnvoyes' });
Utilisateur.hasMany(Colis, { foreignKey: 'recepteurId', as: 'colisRecus' });

Colis.belongsTo(Utilisateur, { foreignKey: 'expediteurId', as: 'expediteur' });
Colis.belongsTo(Utilisateur, { foreignKey: 'recepteurId', as: 'recepteur' });

// 🔹 Associations Notifications
Notifications.belongsTo(Colis, { foreignKey: 'colisId', as: 'colis' });
Notifications.belongsTo(Utilisateur, { foreignKey: 'expediteurId', as: 'expediteur' });
Notifications.belongsTo(Utilisateur, { foreignKey: 'recepteurId', as: 'recepteur' });

Utilisateur.hasMany(Notifications, { foreignKey: 'expediteurId', as: 'notificationsEnvoyees' });
Utilisateur.hasMany(Notifications, { foreignKey: 'recepteurId', as: 'notificationsRecues' });

module.exports = {
  Utilisateur,
  Colis,
  Notifications,
  MessageClient,
};