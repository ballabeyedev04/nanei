require('dotenv').config();
const { Sequelize } = require('sequelize');

// SSL activé uniquement si DB_SSL_CA est fourni (DB distante) — pas nécessaire en loopback (même serveur)
const sslEnabled = !!process.env.DB_SSL_CA;

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    dialect: 'postgres',
    logging: false,
    dialectOptions: sslEnabled
      ? { ssl: { require: true, rejectUnauthorized: false, ca: process.env.DB_SSL_CA } }
      : {},
    pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
    define: { freezeTableName: true
    }
  });

module.exports = sequelize;
