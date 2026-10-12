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
  },
  // URL (Cloudflare R2) de la photo de profil — colonne photo_profil
  photoProfil: {
    type: DataTypes.STRING(512),
    allowNull: true
  },
  // Compte destinataire créé automatiquement à l'envoi d'un colis (la
  // personne ne s'est pas encore inscrite) — colonne compte_auto. Seuls ces
  // comptes peuvent être « revendiqués » à l'inscription. Un client désactivé
  // par un admin a compteAuto = false : personne ne peut le reprendre en se
  // réinscrivant avec son e-mail ou son téléphone.
  compteAuto: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  }

}, {
  tableName: 'utilisateur',
  timestamps: true,
  paranoid: true,
  underscored: true
});

// Champs internes jamais envoyés au client (réponses JSON des routes admin et
// client) : hash du mot de passe, jetons de réinitialisation, OTP, jeton push.
// Ils restent lisibles dans le code serveur (`user.mot_de_passe`…), seule la
// sérialisation JSON les retire.
User.CHAMPS_PRIVES = [
  'mot_de_passe',
  'resetPasswordToken',
  'resetPasswordExpires',
  'passwordChangedAt',
  'otpCode',
  'otpExpires',
  'fcm_token',
];

User.prototype.toJSON = function toJSON() {
  const valeurs = { ...this.get() };
  for (const champ of User.CHAMPS_PRIVES) delete valeurs[champ];
  return valeurs;
};

module.exports = User;
