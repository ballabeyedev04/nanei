// models/index.js
const Utilisateur = require('./utilisateur.model');
const Colis = require('./colis.model');

// Associations
Utilisateur.hasMany(Colis, { foreignKey: 'expediteurId', as: 'colisEnvoyes' });
Utilisateur.hasMany(Colis, { foreignKey: 'recepteurId', as: 'colisRecus' });

Colis.belongsTo(Utilisateur, { foreignKey: 'expediteurId', as: 'expediteur' });
Colis.belongsTo(Utilisateur, { foreignKey: 'recepteurId', as: 'recepteur' });

module.exports = {
  Utilisateur,
  Colis
};
