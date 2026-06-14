const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const Country = require('./country.model');

const ShippingPrice = sequelize.define('ShippingPrice', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  countryId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: Country,
      key: 'id',
    },
  },
  type: {
    type: DataTypes.ENUM('aérien', 'maritime'),
    allowNull: false,
  },
  minWeight: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  maxWeight: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  pricePerKg: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
}, {
  timestamps: true,
  tableName: 'shipping_prices',
});

ShippingPrice.belongsTo(Country, { foreignKey: 'countryId', as: 'country' });

module.exports = ShippingPrice;
