const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const Country = require('./country.model');

const ServiceRate = sequelize.define('ServiceRate', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  countryId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: Country, key: 'id' },
  },
  prixRecuperation: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  prixLivraison: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
}, {
  timestamps: true,
  tableName: 'service_rates',
});

ServiceRate.belongsTo(Country, { foreignKey: 'countryId', as: 'country' });

module.exports = ServiceRate;
