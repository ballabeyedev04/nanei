const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Notifications = sequelize.define('Notifications', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
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

  colisId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'colis',
      key: 'id'
    }
  },

  statut: {
    type: DataTypes.ENUM(
        'lu',
        'non_lu'
    ),
    defaultValue: 'non_lu'
    }

}, {
  tableName: 'notifications',
  timestamps: true,
  paranoid: true,
  underscored: true
});

module.exports = Notifications;
