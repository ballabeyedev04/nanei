const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

/**
 * Table de stockage des refresh tokens.
 * On stocke le hash SHA-256 du token JWT plutôt que le token brut,
 * de sorte que même une fuite de la DB ne compromet pas les tokens actifs.
 * La rotation est forcée à chaque refresh (l'ancien token est révoqué).
 */
const RefreshToken = sequelize.define('RefreshToken', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  // SHA-256 hex du token JWT (64 caractères)
  tokenHash: {
    type: DataTypes.CHAR(64),
    allowNull: false,
    unique: true
  },
  utilisateurId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false
  },
  revoked: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false
  }
}, {
  tableName: 'refresh_tokens',
  timestamps: true,
  underscored: true
});

module.exports = RefreshToken;
