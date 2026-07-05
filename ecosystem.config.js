'use strict';

const path = require('path');

module.exports = {
  apps: [
    {
      name: 'nanei-api',
      script: path.join(__dirname, 'src', 'server.js'),

      // Cluster : 1 instance par cœur CPU (Contabo VPS 4 vCPU → 4 workers)
      // Mettre instances: 1 si la DB ne supporte pas bien les connexions parallèles
      instances: process.env.PM2_INSTANCES || 'max',
      exec_mode: 'cluster',

      // Variables d'env injectées par PM2 (complète le .env déjà chargé par dotenv)
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },

      // Logs PM2 (séparés des logs Winston)
      error_file: path.join(__dirname, 'logs', 'pm2-error.log'),
      out_file: path.join(__dirname, 'logs', 'pm2-out.log'),
      log_file: path.join(__dirname, 'logs', 'pm2-combined.log'),
      time: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,

      // Redémarrage automatique si la RAM dépasse 500 MB
      max_memory_restart: '500M',

      // Délai entre 2 redémarrages automatiques
      restart_delay: 3000,

      // Nombre max de redémarrages avant que PM2 abandonne
      max_restarts: 10,
      min_uptime: '10s',

      // Ne pas surveiller les fichiers (les changements se font via git + pm2 reload)
      watch: false,

      // Arrêt propre : PM2 attend SIGTERM + drain des connexions en cours
      kill_timeout: 10000,
      listen_timeout: 8000,
      shutdown_with_message: false,
    },
  ],
};
