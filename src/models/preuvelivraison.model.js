const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const PreuveLivraison = sequelize.define('PreuveLivraison', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  colis_id: {
    type: DataTypes.UUID,
    allowNull: false,
    unique: true,
    references: { model: 'colis', key: 'id' },
  },
  photo_url: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  commentaire: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  gps_lat: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },
  gps_lng: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },
}, {
  tableName: 'preuves_livraison',
  timestamps: true,
  underscored: true,
  updatedAt: false,
});

module.exports = PreuveLivraison;
