-- ============================================================
--  Nanei API — Script d'initialisation PostgreSQL
--  Exécuté automatiquement lors du premier lancement du conteneur
--  Utile pour : extensions, configurations initiales, etc.
-- ============================================================

-- Extensions PostgreSQL (si nécessaire pour Sequelize)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Logs de création
SELECT 'Extensions PostgreSQL activées' AS message;
