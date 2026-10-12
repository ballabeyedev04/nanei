require('dotenv').config();
const sequelize = require('./config/db');
const app = require('./app');
const logger = require('./config/logger');

// Modèles
// Chargés pour leur effet : enregistrer les modèles avant sequelize.sync().
require('./models/utilisateur.model');
require('./models/colis.model');
require('./models/notification.model');
require('./models/messageClient.model');
const seedAdmin = require("./seed/seedAdmin");

const isProd = process.env.NODE_ENV === 'production';

// Configuration attendue en production : avertir au démarrage plutôt que de
// découvrir le problème quand un admin demande un nouveau mot de passe.
if (isProd && !process.env.FRONTEND_URL) {
  logger.error("FRONTEND_URL non défini : les liens « mot de passe oublié » de l'admin utiliseront la première origine HTTPS de CORS_ORIGIN, ou ne seront pas envoyés. Définir FRONTEND_URL=https://<adresse de l'admin> dans .env");
}

// ── Handlers process non capturées ──────────────────────────────────────────
// Sans ça, une exception/rejet non intercepté ailleurs dans le code plante
// le process sans log exploitable (ou pire, le laisse dans un état
// zombie/incohérent) — on log puis on quitte proprement pour que
// Docker/PM2 relance le service.
process.on('uncaughtException', (err) => {
  logger.error('uncaughtException', { message: err.message, stack: err.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('unhandledRejection', { reason: String(reason) });
  process.exit(1);
});

// Arrêt propre sur SIGTERM (Docker stop / redéploiement)
process.on('SIGTERM', () => {
  logger.info('SIGTERM reçu — arrêt propre');
  process.exit(0);
});

(async () => {
  try {
    if (isProd) {
      // En production : sync({ force: false }) crée les tables manquantes
      // sans jamais toucher aux colonnes existantes. Les changements de
      // schéma (nouvelles colonnes, renommages, etc.) passent désormais par
      // des migrations versionnées — voir src/migrations/ et `npm run migrate`,
      // exécuté par le pipeline de déploiement AVANT le redémarrage du
      // serveur (.github/workflows/deploy.yml).
      await sequelize.sync({ force: false });
      logger.info('Tables synchronisées (production — sans altération de schéma)');
    } else {
      // En développement uniquement : alter:true pour itérer vite sur les
      // modèles. Ne jamais utiliser en production — peut supprimer ou
      // altérer des colonnes existantes silencieusement.
      await sequelize.sync({ alter: true });
      logger.info('Base synchronisée avec succès (développement)');
    }

    // creation admin
    await seedAdmin();

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, '0.0.0.0', () => {
      logger.info(`Serveur lancé sur le port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
    });
  } catch (err) {
    logger.error('Erreur fatale au démarrage', { error: err.message, stack: err.stack });
    process.exit(1);
  }
})();
