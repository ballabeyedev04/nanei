#!/usr/bin/env bash
# ============================================================
#  Chaîne de déploiement — exécute deploy/ci-distant.sh sur le serveur
#
#  Usage : bash scripts/ci/ssh-distant.sh <verifier|deployer|retour> <image> <sha> <journal>
#  Variables : GHCR_USER, GHCR_TOKEN (jeton GITHUB_TOKEN du job, droit
#  packages:read), après scripts/ci/preparer-ssh.sh (hôte « nanei-vps »).
#
#  Le script distant part sur l'entrée standard, précédé des identifiants
#  GHCR : le jeton n'apparaît ni dans la ligne de commande du serveur, ni
#  dans les journaux (GitHub le masque de toute façon), ni sur son disque
#  (docker logout en fin de script distant).
#  Code de sortie = celui du script distant ; sortie copiée dans <journal>.
# ============================================================
set -euo pipefail

MODE="${1:?mode}"
IMAGE="${2:?image}"
SHA="${3:?sha}"
JOURNAL="${4:?journal}"
RACINE="$(cd "$(dirname "$0")/../.." && pwd)"

[[ "$MODE" =~ ^(verifier|deployer|retour)$ ]] || { echo "::error::mode inconnu : $MODE"; exit 2; }
[[ "$SHA" =~ ^[0-9a-f]{40}$ ]] || { echo "::error::sha invalide : $SHA"; exit 2; }
[[ "$IMAGE" =~ ^ghcr\.io/[a-z0-9._/-]+:[0-9a-f]{40}$ ]] || { echo "::error::image invalide : $IMAGE"; exit 2; }
: "${GHCR_USER:?GHCR_USER manquant}" "${GHCR_TOKEN:?GHCR_TOKEN manquant}"

{
  printf 'GHCR_USER=%q\nGHCR_TOKEN=%q\n' "$GHCR_USER" "$GHCR_TOKEN"
  cat "$RACINE/deploy/ci-distant.sh"
} | ssh nanei-vps "bash -s -- $MODE $IMAGE $SHA" 2>&1 | tee "$JOURNAL"
