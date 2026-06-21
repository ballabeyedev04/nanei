const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Colis = sequelize.define('Colis', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },

  reference: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false
  },

  expediteurId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'utilisateur',
      key: 'id'
    }
  },

  recepteurId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'utilisateur',
      key: 'id'
    }
  },

  poids: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },

  prix: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  destination: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  type_colis: {
    type: DataTypes.STRING,
    allowNull: true
  },

  statut: {
    type: DataTypes.ENUM(
      'en_attente', 
      'recupere', 
      'livre'
    ),
    defaultValue: 'en_attente',
  },

}, {
  tableName: 'colis',
  timestamps: true,
  paranoid: true,
  underscored: true
});

module.exports = Colis;
