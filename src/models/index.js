// models/index.js
const Utilisateur = require('./utilisateur.model');
const Colis = require('./colis.model');
const Notifications = require('./notification.model');
const MessageClient = require('./messageClient.model');
const Country = require('./country.model');
const ShippingPrice = require('./shippingPrice.model');
const ServicePrice = require('./servicePrice.model');
const Reclamation = require('./reclamation.model');
const ContactFavori = require('./contactFavori.model');
const PreuveLivraison = require('./preuvelivraison.model');
const Avis = require('./avis.model');
const AuditLog = require('./auditlog.model');
const ColisHistorique = require('./colisHistorique.model');

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

// 🔹 Associations Reclamations
Colis.hasMany(Reclamation, { foreignKey: 'colis_id', as: 'reclamations' });
Reclamation.belongsTo(Colis, { foreignKey: 'colis_id', as: 'colis' });
Reclamation.belongsTo(Utilisateur, { foreignKey: 'utilisateur_id', as: 'utilisateur' });
Utilisateur.hasMany(Reclamation, { foreignKey: 'utilisateur_id', as: 'reclamations' });

// 🔹 Associations ContactFavori
Utilisateur.hasMany(ContactFavori, { foreignKey: 'utilisateur_id', as: 'contacts' });
ContactFavori.belongsTo(Utilisateur, { foreignKey: 'utilisateur_id', as: 'utilisateur' });

// 🔹 Associations PreuveLivraison
Colis.hasOne(PreuveLivraison, { foreignKey: 'colis_id', as: 'preuveLivraison' });
PreuveLivraison.belongsTo(Colis, { foreignKey: 'colis_id', as: 'colis' });

// 🔹 Associations Avis
Colis.hasOne(Avis, { foreignKey: 'colis_id', as: 'avis' });
Avis.belongsTo(Colis, { foreignKey: 'colis_id', as: 'colis' });
Avis.belongsTo(Utilisateur, { foreignKey: 'utilisateur_id', as: 'utilisateur' });

// 🔹 Associations AuditLog
AuditLog.belongsTo(Utilisateur, { foreignKey: 'admin_id', as: 'admin' });

// 🔹 Associations ColisHistorique
Colis.hasMany(ColisHistorique, { foreignKey: 'colis_id', as: 'historique' });
ColisHistorique.belongsTo(Colis, { foreignKey: 'colis_id', as: 'colis' });
ColisHistorique.belongsTo(Utilisateur, { foreignKey: 'admin_id', as: 'admin' });

module.exports = {
  Utilisateur,
  Colis,
  Notifications,
  MessageClient,
  Country,
  ShippingPrice,
  ServicePrice,
  Reclamation,
  ContactFavori,
  PreuveLivraison,
  Avis,
  AuditLog,
  ColisHistorique,
};