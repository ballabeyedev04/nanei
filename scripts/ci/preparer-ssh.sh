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

diagnostiquer_ssh() {
  echo "::group::Diagnostic SSH (données publiques)"
  if [ ! -s "$HOME/.ssh/known_hosts" ]; then
    echo "known_hosts vide : le secret VPS_KNOWN_HOSTS ne contient aucune ligne."
  else
    echo "Lignes lues dans VPS_KNOWN_HOSTS (nom ou adresse → type de clé) :"
    awk 'NF>=3 && $2 ~ /^(ssh-|ecdsa-|sk-)/ { print "  " $1 " → " $2 }' "$HOME/.ssh/known_hosts"
    if ! awk 'NF>=3 && $2 ~ /^(ssh-|ecdsa-|sk-)/' "$HOME/.ssh/known_hosts" | grep -q .; then
      echo "Aucune ligne au format known_hosts (« hôte type clé ») : le secret contient sans doute les EMPREINTES (SHA256:…) au lieu du contenu du fichier produit par ssh-keyscan."
    fi
    if ! awk '{ print $1 }' "$HOME/.ssh/known_hosts" | tr ',' '\n' | grep -qxF "$VPS_HOST"; then
      echo "Aucune ligne pour le nom EXACT de VPS_HOST (« $VPS_HOST ») : régénérer avec « ssh-keyscan $VPS_HOST » (OpenSSH compare le nom tel qu'il est écrit : une IP ne vaut pas pour un domaine)."
    fi
  fi
  echo "::endgroup::"
}

ssh nanei-vps true || {
  diagnostiquer_ssh
  echo "::error::Connexion SSH refusée par $VPS_USER@$VPS_HOST:$PORT (empreinte du serveur absente de VPS_KNOWN_HOSTS, ou clé VPS_SSH_KEY refusée : voir le diagnostic ci-dessus)"
  exit 1
}
echo "Connexion SSH vérifiée."
