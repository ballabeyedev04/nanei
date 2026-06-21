const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const AuditLog = sequelize.define('AuditLog', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  admin_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'utilisateur', key: 'id' },
  },
  action: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  entite: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  entite_id: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  details: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  ip_address: {
    type: DataTypes.STRING,
    allowNull: true,
  },
}, {
  tableName: 'audit_logs',
  timestamps: true,
  underscored: true,
  updatedAt: false,
});

module.exports = AuditLog;
