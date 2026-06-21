const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Reclamation = sequelize.define('Reclamation', {
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
  utilisateur_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'utilisateur', key: 'id' },
  },
  type: {
    type: DataTypes.ENUM('perdu', 'endommagé', 'retard', 'autre'),
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  photos: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: [],
  },
  statut: {
    type: DataTypes.ENUM('ouverte', 'en_cours', 'resolue', 'rejetee'),
    defaultValue: 'ouverte',
    allowNull: false,
  },
  commentaire_admin: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'reclamations',
  timestamps: true,
  underscored: true,
});

module.exports = Reclamation;
