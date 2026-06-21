const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Avis = sequelize.define('Avis', {
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
  utilisateur_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'utilisateur', key: 'id' },
  },
  note: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: { min: 1, max: 5 },
  },
  commentaire: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'avis',
  timestamps: true,
  underscored: true,
  updatedAt: false,
});

module.exports = Avis;
