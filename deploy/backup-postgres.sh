#!/usr/bin/env bash
# ============================================================
#  Nanei API — Sauvegarde PostgreSQL
#  Usage   : bash deploy/backup-postgres.sh
#  Cron    : 0 2 * * * /var/www/nanei-api/deploy/backup-postgres.sh >> /var/log/nanei-backup.log 2>&1
#
#  Fonctionnement (identique au backend Sign) :
#   • Docker Compose → pg_dump via le conteneur postgres
#   • Bare metal → pg_dump direct (postgres doit être installé sur l'hôte)
#   • Compresse le dump en .gz
#   • Upload vers Google Drive via rclone
#   • Garde les 3 dernières sauvegardes en local (purge automatique)
# ============================================================
set -euo pipefail

APP_DIR="/var/www/nanei-api"
BACKUP_DIR="${APP_DIR}/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/naneiapp_${TIMESTAMP}.sql.gz"
KEEP_DAYS=3

# Charger les variables d'environnement depuis .env
if [ -f "${APP_DIR}/.env" ]; then
    set -o allexport
    # shellcheck disable=SC1090
    source <(grep -E '^(DB_|PGPASSWORD)' "${APP_DIR}/.env" | sed 's/ *= */=/')
    set +o allexport
fi

DB_NAME="${DB_NAME:-naneiapp}"
DB_USER="${DB_USER:-naneiuser}"
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5432}"

mkdir -p "${BACKUP_DIR}"

echo "[backup] $(date '+%Y-%m-%d %H:%M:%S') — Début sauvegarde de '${DB_NAME}'"

# Détecter le mode (Docker ou bare metal)
if docker compose -f "${APP_DIR}/docker-compose.prod.yml" ps postgres 2>/dev/null | grep -q "Up"; then
    echo "[backup] Mode : Docker Compose"
    docker compose -f "${APP_DIR}/docker-compose.prod.yml" exec -T postgres \
        pg_dump -U "${DB_USER}" "${DB_NAME}" \
        | gzip > "${BACKUP_FILE}"
else
    echo "[backup] Mode : bare metal (pg_dump direct)"
    PGPASSWORD="${DB_PASSWORD:-}" pg_dump \
        -h "${DB_HOST}" \
        -p "${DB_PORT}" \
        -U "${DB_USER}" \
        "${DB_NAME}" \
        | gzip > "${BACKUP_FILE}"
fi

SIZE=$(du -sh "${BACKUP_FILE}" | cut -f1)
echo "[backup] Sauvegarde créée : ${BACKUP_FILE} (${SIZE})"

# Upload vers Google Drive — même remote rclone que Sign (config partagée sur
# le VPS), dossier dédié pour ne pas mélanger les sauvegardes des deux apps.
RCLONE_BIN=$(command -v rclone || echo "/usr/bin/rclone")
GDRIVE_FOLDER="gdrive:nanei-api-backups"
if [ -x "${RCLONE_BIN}" ]; then
    echo "[backup] Upload vers Google Drive..."
    "${RCLONE_BIN}" copy "${BACKUP_FILE}" "${GDRIVE_FOLDER}"
    echo "[backup] Upload terminé → ${GDRIVE_FOLDER}"
else
    echo "[backup] rclone introuvable — upload Drive ignoré"
fi

# Purger les sauvegardes de plus de KEEP_DAYS jours (local)
find "${BACKUP_DIR}" -name "naneiapp_*.sql.gz" -mtime "+${KEEP_DAYS}" -delete
REMAINING=$(find "${BACKUP_DIR}" -name "naneiapp_*.sql.gz" | wc -l)
echo "[backup] Sauvegardes locales conservées : ${REMAINING}"

echo "[backup] $(date '+%Y-%m-%d %H:%M:%S') — Terminé"
