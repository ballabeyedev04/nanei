const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const UserOtp = sequelize.define('UserOtp', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  utilisateurId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  otpHash: {
    type: DataTypes.STRING,
    allowNull: false
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false
  },
  failedAttempts: { // SÉCURITÉ: Compteur pour brute-force protection
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false
  },
  lockedUntil: { // SÉCURITÉ: Blocage après 3 tentatives échouées pendant 15 min
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'user_otps',
  timestamps: true,
  underscored: true
});

module.exports = UserOtp;
