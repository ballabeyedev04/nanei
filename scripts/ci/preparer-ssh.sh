#!/usr/bin/env bash
# ============================================================
#  Chaîne de déploiement — accès SSH au serveur (VPS)
#
#  Variables (secrets GitHub) : VPS_SSH_KEY (clé privée), VPS_HOST, VPS_USER,
#  VPS_PORT (facultatif, 22), VPS_KNOWN_HOSTS (facultatif mais recommandé :
#  ligne(s) « known_hosts » du serveur, voir deploy/README.md).
#
#  Écrit ~/.ssh/nanei_vps (clé) et ~/.ssh/known_hosts. Sans VPS_KNOWN_HOSTS,
#  l'empreinte du serveur est relevée à la volée (ssh-keyscan) : pratique,
#  mais un serveur usurpé ne serait pas détecté — avertissement affiché avec
#  l'empreinte à enregistrer.
# ============================================================
set -euo pipefail

for v in VPS_SSH_KEY VPS_HOST VPS_USER; do
  [ -n "${!v:-}" ] || { echo "::error::Secret GitHub manquant : $v (voir deploy/README.md)"; exit 1; }
done
PORT="${VPS_PORT:-22}"

install -m 700 -d "$HOME/.ssh"
umask 077
printf '%s\n' "$VPS_SSH_KEY" | tr -d '\r' > "$HOME/.ssh/nanei_vps"
chmod 600 "$HOME/.ssh/nanei_vps"

if [ -n "${VPS_KNOWN_HOSTS:-}" ]; then
  printf '%s\n' "$VPS_KNOWN_HOSTS" | tr -d '\r' > "$HOME/.ssh/known_hosts"
else
  ssh-keyscan -p "$PORT" -T 15 "$VPS_HOST" 2>/dev/null > "$HOME/.ssh/known_hosts"
  [ -s "$HOME/.ssh/known_hosts" ] || { echo "::error::Serveur $VPS_HOST:$PORT injoignable (ssh-keyscan)"; exit 1; }
  echo "::warning::Secret VPS_KNOWN_HOSTS absent : l'identité du serveur n'est pas vérifiée. Enregistrez-le (deploy/README.md, « Secrets GitHub »)."
  ssh-keygen -lf "$HOME/.ssh/known_hosts" || true
fi

# Options communes, lues par scripts/ci/ssh-distant.sh
{
  echo "Host nanei-vps"
  echo "  HostName $VPS_HOST"
  echo "  User $VPS_USER"
  echo "  Port $PORT"
  echo "  IdentityFile ~/.ssh/nanei_vps"
  echo "  IdentitiesOnly yes"
  echo "  BatchMode yes"
  echo "  StrictHostKeyChecking yes"
  echo "  ServerAliveInterval 30"
  echo "  ServerAliveCountMax 10"
  echo "  ConnectTimeout 20"
} > "$HOME/.ssh/config"
chmod 600 "$HOME/.ssh/config"

ssh nanei-vps true || { echo "::error::Connexion SSH refusée par $VPS_USER@$VPS_HOST:$PORT (clé VPS_SSH_KEY ?)"; exit 1; }
echo "Connexion SSH vérifiée."
