const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const ColisHistorique = sequelize.define('ColisHistorique', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  colis_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'colis', key: 'id' },
  },
  ancien_statut: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  nouveau_statut: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  commentaire: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  admin_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'utilisateur', key: 'id' },
  },
}, {
  tableName: 'colis_historiques',
  timestamps: true,
  underscored: true,
  updatedAt: false,
});

module.exports = ColisHistorique;
