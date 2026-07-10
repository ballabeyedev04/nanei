const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  nom: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  prenom: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: { isEmail: true }
  },
  mot_de_passe: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  adresse: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  telephone: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true
  },
  role: {
    type: DataTypes.ENUM('Admin', 'Particulier'),
    defaultValue: 'Particulier',
    allowNull: false
  },
  statut: {
    type: DataTypes.ENUM('actif', 'inactif'),
    defaultValue: 'actif'
  },
  resetPasswordToken: {
    type: DataTypes.STRING,
    allowNull: true
  },
  resetPasswordExpires: {
    type: DataTypes.DATE,
    allowNull: true
  },
  // Horodatage du dernier changement de mot de passe — permet d'invalider
  // tout JWT émis AVANT ce changement (via auth.middleware), même si son
  // expiration n'est pas encore atteinte. Nécessaire car l'architecture est
  // en JWT stateless (pas de table de sessions/refresh tokens à révoquer).
  passwordChangedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  otpCode: {
    type: DataTypes.STRING(6),
    allowNull: true
  },
  otpExpires: {
    type: DataTypes.DATE,
    allowNull: true
  },
  fcm_token: {
    type: DataTypes.STRING,
    allowNull: true
  }

}, {
  tableName: 'utilisateur',
  timestamps: true,
  paranoid: true,
  underscored: true
});

module.exports = User;
