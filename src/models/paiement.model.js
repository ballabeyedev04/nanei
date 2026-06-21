const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const Colis = require('./colis.model');
const Utilisateur = require('./utilisateur.model');

const Paiement = sequelize.define('Paiement', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  colisId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'colis', key: 'id' },
  },
  payeurId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'utilisateur', key: 'id' },
  },
  prixTotal: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  montantPaye: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
    allowNull: false,
  },
  moyenPaiement: {
    type: DataTypes.ENUM('orange_money', 'wave'),
    allowNull: true,
  },
  statut: {
    type: DataTypes.ENUM('en_attente', 'en_cours', 'paye', 'echoue', 'rembourse'),
    defaultValue: 'en_attente',
    allowNull: false,
  },
  referenceTransaction: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  checkoutUrl: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  webhookPayload: {
    type: DataTypes.JSON,
    allowNull: true,
  },
}, {
  tableName: 'paiements',
  timestamps: true,
  underscored: true,
});

Paiement.belongsTo(Colis,       { foreignKey: 'colisId',  as: 'colis'   });
Paiement.belongsTo(Utilisateur, { foreignKey: 'payeurId', as: 'payeur'  });

module.exports = Paiement;
