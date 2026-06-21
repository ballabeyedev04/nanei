const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const ContactFavori = sequelize.define('ContactFavori', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  utilisateur_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'utilisateur', key: 'id' },
  },
  nom: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  prenom: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  telephone: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  ville: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  pays_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'countries', key: 'id' },
  },
}, {
  tableName: 'contact_favoris',
  timestamps: true,
  underscored: true,
});

module.exports = ContactFavori;
