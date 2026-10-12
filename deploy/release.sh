#!/usr/bin/env bash
# ============================================================
#  Nanei API — Mise en service d'une version (image Docker)
#  NANEI_RELEASE_V2  (marqueur lu par deploy/ci-distant.sh : ne pas retirer)
#
#  Usage (depuis n'importe où ; travaille dans $APP_DIR) :
#    bash deploy/release.sh deployer <image> <sha>
#        Nouvelle version : sauvegarde de la base, migrations, redémarrage,
#        vérification, RETOUR ARRIÈRE AUTOMATIQUE si la vérification échoue.
#    bash deploy/release.sh retour <image> <sha>
#        Remet en service une image existante (version précédente), SANS
#        sauvegarde ni migration. Même vérification, même filet.
#    bash deploy/release.sh deployer local <sha>
#        Secours sans GHCR : construit l'image sur le serveur à partir du
#        code présent dans $APP_DIR (doit être au commit <sha>).
#
#  <image> : ghcr.io/<owner>/<repo>/nanei-api:<sha> (construite et testée par
#  .github/workflows/deploy.yml) ; <sha> : commit complet (40 caractères).
#  Le serveur ne construit plus rien : il TIRE l'image (docker login fait
#  par l'appelant, voir deploy/ci-distant.sh).
#
#  ── Ordre (deployer) ─────────────────────────────────────────────────────
#   0. Verrou (un seul déploiement à la fois sur le serveur)
#   1. Version en service relevée (fichier d'état .deploy/version-courante)
#   2. Nouvelle image tirée et contrôlée (étiquette de commit = <sha>)
#   3. PostgreSQL démarré et prêt
#   4. Sauvegarde de la base (backups/pre-deploy_*.sql.gz)
#   5. Migrations exécutées avec la NOUVELLE image (conteneur temporaire) —
#      si elles échouent : arrêt, l'ancienne version n'a pas été touchée
#   6. Redémarrage du backend sur la nouvelle image
#   7. Vérification /health : 200, db ok ET version = <sha>
#   8. Échec → l'image PRÉCÉDENTE est remise en service et revérifiée, le
#      script sort en erreur. La base n'est JAMAIS restaurée automatiquement
#      (des données ont pu être écrites entre-temps) : la commande exacte de
#      restauration manuelle est affichée.
#   9. Succès → état mis à jour, nanei-api:latest pointe sur la version en
#      service, anciennes images nettoyées (les KEEP_IMAGES plus récentes
#      sont gardées pour les retours arrière).
#
#  ── Migrations : TOUJOURS rétrocompatibles ───────────────────────────────
#  Après un retour arrière, l'ANCIEN code tourne sur le schéma MIGRÉ. Une
#  migration doit donc laisser l'ancienne version fonctionner : ajouter
#  (colonne nullable ou avec défaut, table, index), jamais supprimer ni
#  renommer dans la même version que le code qui cesse de s'en servir.
#  Suppression = en deux temps : version N n'utilise plus la colonne,
#  version N+1 (une fois N validée en production) la supprime.
#
#  Variables facultatives : APP_DIR (/var/www/nanei-api), HEALTH_URL
#  (http://localhost:4000/health), KEEP_IMAGES (5), KEEP_PRE_DEPLOY_BACKUPS
#  (5), DELAI_SANTE_S (120), ATTENTE_VERROU_S (900).
# ============================================================
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/var/www/nanei-api}"
COMPOSE_FILE="docker-compose.prod.yml"
HEALTH_URL="${HEALTH_URL:-http://localhost:4000/health}"   # port hôte (voir docker-compose.prod.yml)
KEEP_IMAGES="${KEEP_IMAGES:-5}"
KEEP_PRE_DEPLOY_BACKUPS="${KEEP_PRE_DEPLOY_BACKUPS:-5}"
DELAI_SANTE_S="${DELAI_SANTE_S:-120}"
ATTENTE_VERROU_S="${ATTENTE_VERROU_S:-900}"
CONTENEUR="nanei_backend"                                   # container_name du service backend
STATE_DIR="$APP_DIR/.deploy"
VERROU="$STATE_DIR/release.lock"
ETAT="$STATE_DIR/version-courante"        # « <image> <sha> » de la version en service
HISTORIQUE="$STATE_DIR/historique.log"    # une ligne par opération
RESULTAT_FICHIER="$STATE_DIR/dernier-resultat"

log() { echo "[release] $(date '+%H:%M:%S') — $*"; }
# Toute commande qui échoue hors d'un test arrête le script : on dit laquelle.
trap 'log "❌ Arrêt sur erreur inattendue (ligne $LINENO) : $BASH_COMMAND"' ERR
# Résultat lisible par la chaîne de déploiement (lignes « RESULTAT clé=valeur »).
resultat() { echo "RESULTAT $1=$2"; echo "$1=$2" >> "$RESULTAT_FICHIER"; }
historique() { printf '%s\t%s\t%s\t%s\t%s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$ACTION" "$SHA" "$IMAGE" "$1" >> "$HISTORIQUE"; }

ACTION="${1:-}"
IMAGE="${2:-}"
SHA="${3:-}"

usage() {
  sed -n '6,17p' "$0" | sed 's/^#  \{0,1\}//'
  exit 2
}

case "$ACTION" in
  deployer|retour) ;;
  *) echo "Action inconnue : « $ACTION »"; usage ;;
esac
[[ "$SHA" =~ ^[0-9a-f]{40}$ ]] || { echo "❌ <sha> doit être un commit complet (40 caractères hexadécimaux) : « $SHA »"; exit 2; }
if [ "$IMAGE" = "local" ]; then
  [ "$ACTION" = "deployer" ] || { echo "❌ « local » n'est possible qu'avec deployer"; exit 2; }
elif ! [[ "$IMAGE" =~ ^[a-z0-9./_-]+:[0-9a-f]{40}$ ]] || [ "${IMAGE##*:}" != "$SHA" ]; then
  echo "❌ <image> doit être <dépôt>:<sha> avec le même sha : « $IMAGE »"; exit 2
fi

cd "$APP_DIR"
mkdir -p "$STATE_DIR" backups
: > "$RESULTAT_FICHIER"
compose() { docker compose -f "$COMPOSE_FILE" "$@"; }

# ── 0. Verrou ────────────────────────────────────────────────────────────────
# deploy/ci-distant.sh prend déjà ce verrou (synchronisation des fichiers +
# mise en service) et le signale par NANEI_VERROU_TENU : ne pas le reprendre
# (un second flock sur le même fichier attendrait indéfiniment).
if [ "${NANEI_VERROU_TENU:-}" != "$VERROU" ]; then
  command -v flock > /dev/null || { log "❌ flock absent du serveur (paquet util-linux)"; exit 1; }
  exec 9>"$VERROU"
  log "Verrou de déploiement ($VERROU)..."
  if ! flock -w "$ATTENTE_VERROU_S" 9; then
    log "❌ Une autre mise en service est en cours depuis plus de ${ATTENTE_VERROU_S} s (verrou $VERROU)."
    exit 1
  fi
fi

if [ ! -f .env ]; then
  log "❌ .env manquant dans $APP_DIR"
  exit 1
fi

# Variables DB (pour pg_dump) lues depuis .env, sans exécuter le fichier
DB_USER="$(grep -E '^DB_USER=' .env | tail -n1 | cut -d= -f2- | tr -d '"'"'"' \r')"
DB_NAME="$(grep -E '^DB_NAME=' .env | tail -n1 | cut -d= -f2- | tr -d '"'"'"' \r')"

etiquette_commit() { docker image inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$1" 2>/dev/null || true; }

# verifier_sante <sha attendu | vide> : 0 si /health répond 200 avec db ok et
# la version attendue (sans sha attendu : 200 suffit — ancienne version dont
# la sonde ne renvoyait que { status: 'OK' }).
SANTE=""
verifier_sante() {
  local attendu="$1" debut corps
  debut=$(date +%s)
  while :; do
    corps="$(curl -fsS --max-time 5 "$HEALTH_URL" 2>/dev/null || true)"
    if [ -n "$corps" ]; then
      if [ -z "$attendu" ]; then SANTE="$corps"; return 0; fi
      if grep -q '"db":"ok"' <<<"$corps" && grep -q "\"version\":\"$attendu\"" <<<"$corps"; then
        SANTE="$corps"; return 0
      fi
    fi
    if [ $(( $(date +%s) - debut )) -ge "$DELAI_SANTE_S" ]; then SANTE="${corps:-pas de réponse 200}"; return 1; fi
    sleep 3
  done
}

demarrer_backend() { NANEI_IMAGE="$1" compose up -d --no-build --no-deps backend; }

# ── 1. Version en service ────────────────────────────────────────────────────
PREC_IMAGE=""
PREC_SHA=""
if [ -s "$ETAT" ]; then read -r PREC_IMAGE PREC_SHA < "$ETAT" || true; fi
ID_EN_SERVICE="$(docker inspect --format '{{.Image}}' "$CONTENEUR" 2>/dev/null || true)"
if [ -n "$ID_EN_SERVICE" ]; then
  ID_ETAT="$( [ -n "$PREC_IMAGE" ] && docker image inspect --format '{{.Id}}' "$PREC_IMAGE" 2>/dev/null || true)"
  if [ "$ID_ETAT" != "$ID_EN_SERVICE" ]; then
    # Version en service inconnue du fichier d'état (premier déploiement par
    # cette chaîne, ou mise en service à la main) : figée sous un tag local
    # pour pouvoir y revenir.
    PREC_IMAGE="nanei-api:avant-$(date +%Y%m%d-%H%M%S)"
    docker tag "$ID_EN_SERVICE" "$PREC_IMAGE"
    PREC_SHA="$(etiquette_commit "$PREC_IMAGE")"
    [[ "$PREC_SHA" =~ ^[0-9a-f]{40}$ ]] || PREC_SHA=""
  fi
else
  log "ℹ️  Aucun conteneur $CONTENEUR en service (première installation ?) : pas de retour arrière possible."
  PREC_IMAGE=""
  PREC_SHA=""
fi
log "Version en service : ${PREC_IMAGE:-aucune} (commit ${PREC_SHA:-inconnu})"
resultat precedente_image "${PREC_IMAGE:-aucune}"
resultat precedente_sha "${PREC_SHA:-inconnu}"

# ── 2. Image à mettre en service ─────────────────────────────────────────────
if [ "$IMAGE" = "local" ]; then
  IMAGE="nanei-api:$SHA"
  [ "$(git rev-parse HEAD 2>/dev/null || true)" = "$SHA" ] || { log "❌ Le code de $APP_DIR n'est pas au commit $SHA"; exit 1; }
  log "Construction locale de $IMAGE (secours sans GHCR)..."
  docker build --build-arg GIT_SHA="$SHA" -t "$IMAGE" .
elif docker image inspect "$IMAGE" > /dev/null 2>&1; then
  log "Image déjà présente : $IMAGE"
else
  log "Téléchargement de $IMAGE..."
  if ! docker pull --quiet "$IMAGE"; then
    log "❌ Impossible de tirer $IMAGE (connexion à ghcr.io ? image supprimée ?). Rien n'a été modifié."
    resultat issue "echec-telechargement"
    historique "echec-telechargement"
    exit 1
  fi
fi
if [ "$(etiquette_commit "$IMAGE")" != "$SHA" ]; then
  log "❌ L'image $IMAGE ne porte pas l'étiquette du commit $SHA (org.opencontainers.image.revision). Rien n'a été modifié."
  resultat issue "echec-image"
  historique "echec-image"
  exit 1
fi
resultat image "$IMAGE"
resultat image_id "$(docker image inspect --format '{{.Id}}' "$IMAGE")"

# ── 3. PostgreSQL ────────────────────────────────────────────────────────────
log "Démarrage / vérification de PostgreSQL..."
compose up -d --wait postgres

SAUVEGARDE=""
if [ "$ACTION" = "deployer" ]; then
  # ── 4. Sauvegarde avant migration ──────────────────────────────────────────
  SAUVEGARDE="backups/pre-deploy_$(date +%Y%m%d_%H%M%S)_${SHA:0:7}.sql.gz"
  log "Sauvegarde de la base '${DB_NAME}' → ${SAUVEGARDE}"
  if ! compose exec -T postgres pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$SAUVEGARDE" || [ ! -s "$SAUVEGARDE" ]; then
    rm -f "$SAUVEGARDE"
    log "❌ Sauvegarde impossible ou vide — rien n'a été modifié."
    resultat issue "echec-sauvegarde"
    historique "echec-sauvegarde"
    exit 1
  fi
  log "Sauvegarde OK ($(du -h "$SAUVEGARDE" | cut -f1))"
  resultat sauvegarde "$APP_DIR/$SAUVEGARDE"
  # Ne garder que les N dernières sauvegardes de déploiement
  ls -1t backups/pre-deploy_*.sql.gz 2>/dev/null | tail -n +$((KEEP_PRE_DEPLOY_BACKUPS + 1)) | xargs -r rm -f

  # ── 5. Migrations avec la nouvelle image ───────────────────────────────────
  # `run --rm --no-deps` : conteneur temporaire avec la config du service
  # backend (.env, NODE_ENV=production, DB_HOST=postgres, réseau), sans
  # toucher au conteneur en service.
  log "Migrations en attente :"
  NANEI_IMAGE="$IMAGE" compose run --rm --no-deps -T backend npm run --silent migrate:status || true

  log "Exécution des migrations..."
  if ! NANEI_IMAGE="$IMAGE" compose run --rm --no-deps -T backend npm run migrate 2>&1 | tee "$STATE_DIR/migrations.log"; then
    log "❌ Échec des migrations — l'ancienne version reste en service (non redémarrée)."
    log "   Une migration a pu s'appliquer partiellement : vérifier avant tout nouvel essai."
    log "   Sauvegarde prise juste avant : $APP_DIR/$SAUVEGARDE"
    resultat issue "echec-migrations"
    historique "echec-migrations"
    exit 1
  fi
  MIGRATIONS="$(grep -oE '== [0-9]+-[A-Za-z0-9_.-]+: migrated' "$STATE_DIR/migrations.log" | sed -E 's/^== //; s/: migrated$//' | paste -sd, - || true)"
  resultat migrations "${MIGRATIONS:-aucune}"
  log "✅ Migrations appliquées : ${MIGRATIONS:-aucune}"
fi

# ── 6. Redémarrage du backend ────────────────────────────────────────────────
log "Mise en service de $IMAGE..."
DEMARRE=oui
demarrer_backend "$IMAGE" || { DEMARRE=non; SANTE="le conteneur n'a pas pu être (re)créé"; }

# ── 7. Vérification ──────────────────────────────────────────────────────────
log "Vérification de ${HEALTH_URL} (db ok + version ${SHA:0:7}, ${DELAI_SANTE_S} s max)..."
if [ "$DEMARRE" = "oui" ] && verifier_sante "$SHA"; then
  log "✅ Backend opérationnel : $SANTE"
  printf '%s %s\n' "$IMAGE" "$SHA" > "$ETAT.tmp" && mv "$ETAT.tmp" "$ETAT"
  # nanei-api:latest = version en service (compose sans NANEI_IMAGE, à la main)
  [ "$IMAGE" = "nanei-api:latest" ] || docker tag "$IMAGE" nanei-api:latest
  resultat issue "succes"
  resultat sante "$SANTE"
  historique "succes"

  # ── 9. Nettoyage des anciennes images ──────────────────────────────────────
  # Les KEEP_IMAGES plus récentes de chaque dépôt sont gardées (retours
  # arrière rapides) ; jamais l'image en service ni la précédente.
  for depot in "${IMAGE%:*}" nanei-api; do
    docker image ls "$depot" --format '{{.Repository}}:{{.Tag}}' \
      | grep -v ':<none>$' | grep -vxF "nanei-api:latest" \
      | tail -n +$((KEEP_IMAGES + 1)) \
      | while read -r ref; do
          if [ "$ref" = "$IMAGE" ] || [ "$ref" = "$PREC_IMAGE" ]; then continue; fi
          docker image rm "$ref" > /dev/null 2>&1 && log "Image supprimée : $ref" || true
        done || true   # aucune image à supprimer : grep sort en 1, sans gravité
  done
  docker image prune -f > /dev/null 2>&1 || true
  exit 0
fi

# ── 8. Échec : retour arrière automatique ────────────────────────────────────
log "❌ La nouvelle version ne répond pas correctement : $SANTE"
log "   Derniers journaux du backend :"
compose logs backend --tail=80 || true
resultat sante_nouvelle "$SANTE"

restauration_base() {
  [ -n "$SAUVEGARDE" ] || return 0
  cat <<EOF

  ⚠️  La base N'A PAS été restaurée (des données ont pu être écrites depuis).
      Les migrations de cette version sont appliquées ; elles doivent être
      rétrocompatibles (voir l'en-tête de deploy/release.sh).
      Si — et seulement si — il faut revenir à l'état d'avant le déploiement :

      cd $APP_DIR
      docker compose -f $COMPOSE_FILE stop backend
      docker compose -f $COMPOSE_FILE exec -T postgres psql -U $DB_USER -d postgres -v ON_ERROR_STOP=1 -c 'DROP DATABASE "$DB_NAME" WITH (FORCE)' -c 'CREATE DATABASE "$DB_NAME" OWNER "$DB_USER"'
      gunzip -c $APP_DIR/$SAUVEGARDE | docker compose -f $COMPOSE_FILE exec -T postgres psql -U $DB_USER -d $DB_NAME -v ON_ERROR_STOP=1
      docker compose -f $COMPOSE_FILE start backend

EOF
}

if [ -z "$PREC_IMAGE" ]; then
  log "❌ Aucune version précédente connue : pas de retour arrière possible. Le backend est HORS SERVICE."
  resultat issue "echec-sans-retour"
  historique "echec-sans-retour"
  restauration_base
  exit 1
fi

log "↩️  Retour arrière automatique : remise en service de $PREC_IMAGE..."
if demarrer_backend "$PREC_IMAGE" && verifier_sante "$PREC_SHA"; then
  log "✅ Version précédente remise en service et vérifiée : $SANTE"
  resultat issue "echec-retour-arriere-ok"
  resultat sante "$SANTE"
  historique "echec-retour-arriere-ok"
  [ "$PREC_IMAGE" = "nanei-api:latest" ] || docker tag "$PREC_IMAGE" nanei-api:latest
  restauration_base
  log "❌ Déploiement de ${SHA:0:7} ÉCHOUÉ — la version ${PREC_SHA:0:7}${PREC_SHA:+ }($PREC_IMAGE) est de nouveau en service."
  exit 1
fi

log "🚨 La version précédente ne répond pas non plus : $SANTE"
compose logs backend --tail=80 || true
resultat issue "echec-retour-arriere-ko"
historique "echec-retour-arriere-ko"
restauration_base
log "🚨 BACKEND HORS SERVICE — intervention manuelle requise (voir deploy/README.md, « Dépannage »)."
exit 3
