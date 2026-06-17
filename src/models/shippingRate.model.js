const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const Country = require('./country.model');

// Un seul enregistrement par pays contient les tarifs aérien ET maritime
const ShippingRate = sequelize.define('ShippingRate', {
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
  // Aérien
  minWeightAerien: { type: DataTypes.FLOAT, allowNull: false },
  maxWeightAerien: { type: DataTypes.FLOAT, allowNull: false },
  priceAerienPerKg: { type: DataTypes.FLOAT, allowNull: false },
  // Maritime
  minWeightMaritime: { type: DataTypes.FLOAT, allowNull: false },
  maxWeightMaritime: { type: DataTypes.FLOAT, allowNull: false },
  priceMaritimePerKg: { type: DataTypes.FLOAT, allowNull: false },
}, {
  timestamps: true,
  tableName: 'shipping_rates',
});

ShippingRate.belongsTo(Country, { foreignKey: 'countryId', as: 'country' });

module.exports = ShippingRate;
