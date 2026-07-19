require('dotenv').config();

/**
 * Configuration Sequelize CLI (npx sequelize-cli db:migrate / db:migrate:undo).
 * Distincte de src/config/db.js (instance Sequelize applicative) — le CLI ne
 * peut pas réutiliser une instance déjà construite, il a besoin de ce fichier
 * de config au format attendu par sequelize-cli.
 */
module.exports = {
  development: {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host:     process.env.DB_HOST || 'localhost',
    dialect:  'postgres',
    logging:  false
  },
  production: {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host:     process.env.DB_HOST,
    dialect:  'postgres',
    logging:  false,
    dialectOptions: process.env.DB_SSL_CA
      ? { ssl: { require: true, rejectUnauthorized: false, ca: process.env.DB_SSL_CA } }
      : {}
  }
};
