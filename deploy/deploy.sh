#!/bin/bash
# ============================================================
#  Nanei API — Script de déploiement production
#  Usage : bash deploy/deploy.sh
#
#  Prérequis :
#   • Docker & Docker Compose installés
#   • Fichier .env rempli avec les secrets
#   • Répertoires /var/www/nanei-api existants
# ============================================================

set -e

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
git fetch origin
git reset --hard origin/main

# ── Créer les répertoires nécessaires ───────────────────────────────────────
echo "📁 Création des répertoires..."
mkdir -p uploads logs

# ── Build, sauvegarde, migrations, redémarrage, contrôle /health ────────────
# Même procédure que le CI/CD (voir deploy/release.sh) : les migrations sont
# exécutées AVANT de redémarrer le backend, et une erreur arrête le
# déploiement (plus de `|| true` qui masquait les échecs).
bash deploy/release.sh

# ── Afficher les logs ──────────────────────────────────────────────────────
echo ""
echo "📊 Derniers logs du backend :"
docker compose -f "$COMPOSE_FILE" logs backend --tail=20

echo ""
echo "✅ Déploiement terminé avec succès !"
echo "🌐 API disponible sur : http://localhost:4000 (port hôte, derrière Nginx)"
echo "💻 Pour surveiller les logs : docker compose -f $COMPOSE_FILE logs -f backend"
