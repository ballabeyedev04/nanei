#!/usr/bin/env bash
# ============================================================
#  Nanei API — Mise en service d'une nouvelle version
#  Usage : bash deploy/release.sh   (depuis /var/www/nanei-api, code déjà à jour)
#
#  Appelé par le CI/CD (.github/workflows/deploy.yml) après le `git pull`,
#  et par deploy/deploy.sh. Plus besoin de se connecter au serveur pour
#  lancer les migrations : elles font partie du déploiement.
#
#  Ordre (important) :
#   1. PostgreSQL démarré et prêt
#   2. Construction de la NOUVELLE image backend (l'ancien conteneur tourne
#      toujours, aucune coupure)
#   3. Sauvegarde de la base AVANT migration (backups/pre-deploy_*.sql.gz)
#   4. Migrations (src/migrations/) exécutées avec la NOUVELLE image, dans un
#      conteneur temporaire
#   5. Seulement si les migrations ont réussi : redémarrage du backend sur la
#      nouvelle image
#   6. Vérification /health (le déploiement échoue si le backend ne répond pas)
#
#  Si une migration échoue, le script s'arrête AVANT l'étape 5 : l'ancienne
#  version continue de tourner (les migrations sont additives : l'ancien code
#  reste compatible), et le CI/CD est marqué en échec.
# ============================================================
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/nanei-api}"
COMPOSE_FILE="docker-compose.prod.yml"
HEALTH_URL="${HEALTH_URL:-http://localhost:4000/health}"   # port hôte (voir docker-compose.prod.yml)
KEEP_PRE_DEPLOY_BACKUPS=5

cd "$APP_DIR"
compose() { docker compose -f "$COMPOSE_FILE" "$@"; }
log() { echo "[release] $(date '+%H:%M:%S') — $*"; }

if [ ! -f .env ]; then
  log "❌ .env manquant dans $APP_DIR"
  exit 1
fi

# Variables DB (pour pg_dump) lues depuis .env, sans exécuter le fichier
DB_USER="$(grep -E '^DB_USER=' .env | tail -n1 | cut -d= -f2- | tr -d '"'"'"' \r')"
DB_NAME="$(grep -E '^DB_NAME=' .env | tail -n1 | cut -d= -f2- | tr -d '"'"'"' \r')"

# ── 1. PostgreSQL ────────────────────────────────────────────────────────────
log "Démarrage / vérification de PostgreSQL..."
compose up -d --wait postgres

# ── 2. Nouvelle image backend ───────────────────────────────────────────────
log "Construction de la nouvelle image backend..."
compose build backend

# ── 3. Sauvegarde avant migration ───────────────────────────────────────────
mkdir -p backups
BACKUP_FILE="backups/pre-deploy_$(date +%Y%m%d_%H%M%S).sql.gz"
log "Sauvegarde de la base '${DB_NAME}' → ${BACKUP_FILE}"
compose exec -T postgres pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_FILE"
if [ ! -s "$BACKUP_FILE" ]; then
  log "❌ Sauvegarde vide — migrations annulées"
  exit 1
fi
log "Sauvegarde OK ($(du -h "$BACKUP_FILE" | cut -f1))"
# Ne garder que les N dernières sauvegardes de déploiement
ls -1t backups/pre-deploy_*.sql.gz 2>/dev/null | tail -n +$((KEEP_PRE_DEPLOY_BACKUPS + 1)) | xargs -r rm -f

# ── 4. Migrations avec la nouvelle image ────────────────────────────────────
# `run --rm --no-deps` : conteneur temporaire avec la config du service
# backend (.env, NODE_ENV=production, DB_HOST=postgres, réseau), sans
# toucher au conteneur en service.
log "Migrations en attente :"
compose run --rm --no-deps -T backend npm run --silent migrate:status || true

log "Exécution des migrations..."
if ! compose run --rm --no-deps -T backend npm run migrate; then
  log "❌ Échec des migrations — l'ancienne version reste en service."
  log "   Sauvegarde disponible : ${APP_DIR}/${BACKUP_FILE}"
  exit 1
fi
log "✅ Migrations appliquées"

# ── 5. Redémarrage du backend ───────────────────────────────────────────────
log "Redémarrage du backend sur la nouvelle image..."
compose up -d --no-build backend

# ── 6. Vérification ─────────────────────────────────────────────────────────
log "Vérification de ${HEALTH_URL}..."
for i in $(seq 1 12); do
  if curl -fsS "$HEALTH_URL" > /dev/null; then
    log "✅ Backend opérationnel"
    exit 0
  fi
  sleep 5
done

log "❌ Le backend ne répond pas après 60 s. Derniers logs :"
compose logs backend --tail=50
exit 1
