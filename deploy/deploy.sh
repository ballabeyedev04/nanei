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

# ── Démarrer/reconstruire les conteneurs ────────────────────────────────────
echo "🐳 Construction et démarrage des conteneurs..."
docker compose -f "$COMPOSE_FILE" up -d --build

# ── Attendre que PostgreSQL soit prêt ────────────────────────────────────────
echo "⏳ Attente de la disponibilité de PostgreSQL..."
sleep 10

# ── Exécuter les migrations ─────────────────────────────────────────────────
echo "🔄 Exécution des migrations Sequelize..."
docker compose -f "$COMPOSE_FILE" exec -T backend npm run migrate 2>/dev/null || true

# ── Vérifier la santé du backend ────────────────────────────────────────────
echo "🏥 Vérification de la santé du backend..."
MAX_ATTEMPTS=5
ATTEMPT=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
  if curl -f http://localhost:3000/health > /dev/null 2>&1; then
    echo "✅ Backend est en bonne santé"
    break
  fi
  ATTEMPT=$((ATTEMPT + 1))
  echo "⏳ Tentative $ATTEMPT/$MAX_ATTEMPTS..."
  sleep 5
done

if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
  echo "❌ Erreur : Backend n'est pas devenu healthy"
  exit 1
fi

# ── Afficher les logs ──────────────────────────────────────────────────────
echo ""
echo "📊 Derniers logs du backend :"
docker compose -f "$COMPOSE_FILE" logs backend --tail=20

echo ""
echo "✅ Déploiement terminé avec succès !"
echo "🌐 API disponible sur : http://localhost:3000"
echo "💻 Pour surveiller les logs : docker compose -f $COMPOSE_FILE logs -f backend"
