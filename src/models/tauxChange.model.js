const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

// Taux de conversion EUR -> FCFA utilisé pour l'affichage double devise côté
// mobile. Modifiable par l'admin, jamais supprimable (pas de route DELETE).
const TauxChange = sequelize.define('TauxChange', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  devise_source: {
    type: DataTypes.STRING(3),
    allowNull: false,
    defaultValue: 'EUR',
  },
  devise_cible: {
    type: DataTypes.STRING(4),
    allowNull: false,
    defaultValue: 'FCFA',
  },
  valeur: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
}, {
  timestamps: true,
  tableName: 'taux_change',
});

module.exports = TauxChange;
