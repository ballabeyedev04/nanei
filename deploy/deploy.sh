#!/bin/bash
# ============================================================
#  Nanei API — Déploiement MANUEL de secours (sans la chaîne GitHub)
#  Usage : bash deploy/deploy.sh
#
#  Le déploiement normal passe par GitHub Actions (.github/workflows/deploy.yml) :
#  image construite et testée par le CI, tirée depuis GHCR. Ce script sert
#  seulement si GitHub / GHCR est indisponible : il met le serveur au dernier
#  commit de main et CONSTRUIT l'image sur place (non testée par le CI !),
#  avec le même filet (sauvegarde, migrations, vérification, retour arrière).
#
#  Prérequis :
#   • Docker & Docker Compose installés
#   • Fichier .env rempli avec les secrets
#   • Répertoires /var/www/nanei-api existants
# ============================================================

set -euo pipefail

PROJECT_NAME="nanei-api"
PROJECT_DIR="/var/www/nanei-api"
COMPOSE_FILE="docker-compose.prod.yml"

echo "🚀 Déploiement de $PROJECT_NAME..."

# ── Vérifier que le projet existe ────────────────────────────────────────────
if [ ! -d "$PROJECT_DIR" ]; then
  echo "❌ Erreur : $PROJECT_DIR n'existe pas"
  exit 1
fi

cd "$PROJECT_DIR"

# ── Vérifier que .env existe ────────────────────────────────────────────────
if [ ! -f ".env" ]; then
  echo "❌ Erreur : .env manquant. Copie .env.example et remplis les secrets."
  exit 1
fi

# ── Récupérer le nouveau code ───────────────────────────────────────────────
echo "📥 Récupération du code depuis Git..."
# Fichiers suivis modifiés localement : on refuse plutôt que de les écraser
# (avant : git reset --hard, qui les effaçait sans prévenir).
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  git status --short --untracked-files=no
  echo "❌ Des fichiers suivis ont été modifiés sur le serveur : les reporter dans le dépôt ou les annuler, puis relancer."
  exit 1
fi
git fetch origin main
git -c advice.detachedHead=false checkout --detach origin/main
SHA="$(git rev-parse HEAD)"

# ── Créer les répertoires nécessaires ───────────────────────────────────────
echo "📁 Création des répertoires..."
mkdir -p uploads logs

# ── Construction locale, sauvegarde, migrations, redémarrage, contrôle ─────
# Même procédure que le CI/CD (voir deploy/release.sh), image construite ici.
bash deploy/release.sh deployer local "$SHA"

# ── Afficher les logs ──────────────────────────────────────────────────────
echo ""
echo "📊 Derniers logs du backend :"
docker compose -f "$COMPOSE_FILE" logs backend --tail=20

echo ""
echo "✅ Déploiement terminé avec succès !"
echo "🌐 API disponible sur : http://localhost:4000 (port hôte, derrière Nginx)"
echo "💻 Pour surveiller les logs : docker compose -f $COMPOSE_FILE logs -f backend"
