const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const Country = require('./country.model');

const ServicePrice = sequelize.define('ServicePrice', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  serviceType: {
    type: DataTypes.ENUM('récupération', 'livraison'),
    allowNull: false,
  },
  countryId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: Country,
      key: 'id',
    },
  },
  price: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
}, {
  timestamps: true,
  tableName: 'service_prices',
});

ServicePrice.belongsTo(Country, { foreignKey: 'countryId', as: 'country' });

module.exports = ServicePrice;
