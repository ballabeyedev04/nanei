# ============================================================
#  Nanei API — Dockerfile multi-stage (production)
#  Stage 1 : deps    → installe uniquement les dépendances de prod
#  Stage 2 : runner  → image finale légère
# ============================================================

# ── Stage 1 : installation des dépendances ───────────────────────────────────
FROM node:22-slim AS deps

WORKDIR /app

# Copier les manifestes en premier pour maximiser le cache Docker
COPY package*.json ./

# Dépendances système requises pour les modules natifs (sharp, etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
        python3 \
        make \
        g++ \
        libvips-dev \
    && rm -rf /var/lib/apt/lists/*

# Installer uniquement les dépendances de production
RUN npm ci --omit=dev --no-audit --no-fund


# ── Stage 2 : image finale ────────────────────────────────────────────────────
FROM node:22-slim AS runner

# Dépendances runtime (pas de build tools)
RUN apt-get update && apt-get install -y --no-install-recommends \
        # Polices pour génération PDF (html-pdf-node / puppeteer)
        libfontconfig1 \
        libfreetype6 \
        fonts-liberation \
        fonts-dejavu-core \
        # Sharp / libvips (runtime uniquement)
        libvips \
        # @sparticuz/chromium (puppeteer-core) — libs partagées requises pour lancer Chromium headless
        ca-certificates \
        libnss3 \
        libatk1.0-0 \
        libatk-bridge2.0-0 \
        libcups2 \
        libxkbcommon0 \
        libxcomposite1 \
        libxdamage1 \
        libxrandr2 \
        libxfixes3 \
        libgbm1 \
        libasound2 \
        libpango-1.0-0 \
        libpangocairo-1.0-0 \
        libx11-xcb1 \
        # curl pour le HEALTHCHECK
        curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copier les dépendances de prod depuis le stage deps
COPY --from=deps /app/node_modules ./node_modules

# Copier le code source
COPY --chown=node:node . .

# Créer les répertoires nécessaires avec les bonnes permissions
RUN mkdir -p logs uploads \
    && chown -R node:node /app

# Basculer vers l'utilisateur non-root (uid 1000, inclus dans node:slim)
USER node

EXPOSE 3000

# Healthcheck : interroge /health toutes les 30 s
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

CMD ["node", "src/server.js"]
