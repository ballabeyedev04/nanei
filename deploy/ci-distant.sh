#!/usr/bin/env bash
# ============================================================
#  Nanei API — partie SERVEUR de la chaîne de déploiement
#
#  N'est PAS lancé depuis le serveur : la chaîne GitHub l'envoie par SSH sur
#  l'entrée standard, précédé de deux lignes GHCR_USER=… / GHCR_TOKEN=…
#  (jeton GITHUB_TOKEN du job, valable le temps du job, jamais écrit sur le
#  disque ni dans la ligne de commande) :
#
#    { printf 'GHCR_USER=%q\nGHCR_TOKEN=%q\n' …; cat deploy/ci-distant.sh; } \
#      | ssh … "bash -s -- <mode> <image> <sha>"
#
#  C'est donc toujours la version TESTÉE de ce script qui s'exécute, même si
#  le serveur est encore sur une ancienne version des fichiers.
#
#  Modes :
#    verifier <image> <sha>  Essai à blanc / contrôle préalable : prérequis du
#                            serveur, fichiers suivis non modifiés, accès à
#                            GHCR (l'image est tirée). Ne modifie RIEN en service.
#    deployer <image> <sha>  Synchronise les fichiers de déploiement au commit
#                            EXACT <sha> (checkout détaché), puis
#                            deploy/release.sh deployer <image> <sha>.
#    retour   <image> <sha>  Remet en service une image existante via
#                            deploy/release.sh retour (fichiers inchangés).
# ============================================================
set -Eeuo pipefail

# Toute la logique est dans une fonction appelée avec l'entrée standard
# fermée : bash lit ce script sur stdin, et une commande qui lirait stdin
# (docker, git…) avalerait sinon la suite du script.
main() {
  local MODE="${1:-}" IMAGE="${2:-}" SHA="${3:-}"
  local APP_DIR="${NANEI_APP_DIR:-/var/www/nanei-api}"
  local VERROU="$APP_DIR/.deploy/release.lock"

  log() { echo "[serveur] $(date '+%H:%M:%S') — $*"; }
  ko() { echo "RESULTAT issue=$1"; log "❌ $2"; exit 1; }

  case "$MODE" in verifier|deployer|retour) ;; *) ko "parametres" "mode inconnu « $MODE »" ;; esac
  [[ "$SHA" =~ ^[0-9a-f]{40}$ ]] || ko "parametres" "sha invalide « $SHA »"
  [[ "$IMAGE" =~ ^ghcr\.io/[a-z0-9._/-]+/nanei-api:[0-9a-f]{40}$ ]] && [ "${IMAGE##*:}" = "$SHA" ] \
    || ko "parametres" "image invalide « $IMAGE »"
  [ -n "${GHCR_TOKEN:-}" ] && [ -n "${GHCR_USER:-}" ] || ko "parametres" "identifiants GHCR absents"

  for outil in docker git flock curl gzip; do
    command -v "$outil" > /dev/null || ko "prerequis" "outil absent sur le serveur : $outil"
  done
  docker compose version > /dev/null 2>&1 || ko "prerequis" "docker compose (v2) absent"
  [ -d "$APP_DIR/.git" ] || ko "prerequis" "$APP_DIR n'est pas un dépôt git"
  cd "$APP_DIR"
  [ -f .env ] || ko "prerequis" ".env absent de $APP_DIR"

  # Fichiers SUIVIS modifiés sur le serveur : on refuse plutôt que d'écraser
  # (.env, sauvegardes, journaux et fichiers non suivis ne comptent pas).
  local modifies
  modifies="$(git status --porcelain --untracked-files=no)"
  if [ -n "$modifies" ]; then
    echo "$modifies"
    ko "fichiers-modifies" "des fichiers suivis par git ont été modifiés sur le serveur (liste ci-dessus). Les reporter dans le dépôt (ou les annuler : git checkout -- <fichier>), puis relancer."
  fi

  # Accès à GHCR pour ce job seulement : déconnexion quoi qu'il arrive.
  trap 'docker logout ghcr.io > /dev/null 2>&1 || true' EXIT
  printf '%s' "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USER" --password-stdin > /dev/null \
    || ko "ghcr" "connexion à ghcr.io refusée (droits du paquet : voir deploy/README.md)"
  unset GHCR_TOKEN

  mkdir -p "$APP_DIR/.deploy"

  case "$MODE" in
    verifier)
      log "Commit en place : $(git rev-parse --short HEAD) ; version en service : $(cat .deploy/version-courante 2>/dev/null || echo 'inconnue (jamais déployé par cette chaîne)')"
      git fetch --quiet origin "$SHA" 2>/dev/null || git fetch --quiet origin main \
        || ko "git" "git fetch impossible depuis le serveur"
      git cat-file -e "$SHA^{commit}" 2>/dev/null || ko "git" "commit $SHA introuvable sur le serveur après fetch"
      log "Téléchargement de l'image (contrôle d'accès à GHCR)..."
      docker pull --quiet "$IMAGE" > /dev/null || ko "ghcr" "impossible de tirer $IMAGE"
      local etiquette
      etiquette="$(docker image inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$IMAGE")"
      [ "$etiquette" = "$SHA" ] || ko "image" "l'image ne porte pas l'étiquette du commit $SHA"
      local libre
      libre="$(df -Pk "$APP_DIR" | awk 'NR==2 {print int($4/1024)}')"
      [ "${libre:-0}" -ge 2048 ] || ko "disque" "moins de 2 Go libres sur $APP_DIR (${libre} Mo)"
      echo "RESULTAT disque_libre_mo=$libre"
      echo "RESULTAT issue=verifie"
      log "✅ Serveur prêt : prérequis, fichiers, accès GHCR et image vérifiés (rien n'a été modifié en service)."
      ;;

    deployer|retour)
      # Un seul déploiement à la fois : la synchronisation des fichiers ET la
      # mise en service se font sous le même verrou que deploy/release.sh.
      exec 9>"$VERROU"
      log "Verrou de déploiement..."
      flock -w 900 9 || ko "verrou" "une autre mise en service occupe le serveur depuis plus de 15 min ($VERROU)"
      export NANEI_VERROU_TENU="$VERROU"

      if [ "$MODE" = "deployer" ]; then
        # Fichiers de déploiement (deploy/, docker-compose.prod.yml) au commit
        # EXACT testé — plus de « git pull origin main », qui prenait ce qui
        # était sur main au moment du déploiement, testé ou non.
        log "Synchronisation des fichiers au commit ${SHA:0:7}..."
        git fetch --quiet origin "$SHA" 2>/dev/null || git fetch --quiet origin main \
          || ko "git" "git fetch impossible depuis le serveur"
        git cat-file -e "$SHA^{commit}" 2>/dev/null || ko "git" "commit $SHA introuvable sur le serveur après fetch"
        git -c advice.detachedHead=false checkout --quiet --detach "$SHA" || ko "git" "checkout de $SHA impossible"
        [ "$(git rev-parse HEAD)" = "$SHA" ] || ko "git" "le serveur n'est pas au commit $SHA après checkout"
        log "Fichiers au commit $(git log -1 --format='%h — %s')"
      fi

      grep -q 'NANEI_RELEASE_V2' deploy/release.sh \
        || ko "release-ancienne" "deploy/release.sh du serveur est l'ancienne version (sans retour arrière) : faire d'abord un déploiement normal par la chaîne"

      local code=0
      APP_DIR="$APP_DIR" bash deploy/release.sh "$MODE" "$IMAGE" "$SHA" || code=$?
      exit "$code"
      ;;
  esac
}

main "$@" < /dev/null
