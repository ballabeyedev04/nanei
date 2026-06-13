const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const MessageClient = sequelize.define('MessageClient', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: { isEmail: true },
  },
  objet: {
    type: DataTypes.STRING(200),
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
}, {
  tableName: 'message_client',
  timestamps: true,
});

module.exports = MessageClient;
