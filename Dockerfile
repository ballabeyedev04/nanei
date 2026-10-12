# ============================================================
#  Nanei API — Dockerfile multi-stage (production)
#  Stage 1 : deps    → installe uniquement les dépendances de prod
#  Stage 2 : runner  → image finale légère
#
#  Construite UNE fois par la chaîne de déploiement (.github/workflows/deploy.yml)
#  à partir du commit testé, poussée sur ghcr.io/<owner>/<repo>/nanei-api:<sha>,
#  puis TIRÉE par le serveur, qui ne construit plus rien.
#
#  Image de base épinglée par empreinte (digest) : deux constructions du même
#  commit partent de la même base. Mise à jour : relever le digest de la
#  nouvelle version (docker buildx imagetools inspect node:22-bookworm-slim ; Debian 12, nom
#  des paquets apt ci-dessous) et
#  remplacer les deux lignes FROM.
# ============================================================

# ── Stage 1 : installation des dépendances ───────────────────────────────────
FROM node:22.23.3-bookworm-slim@sha256:c3de60bf2f9dd0ac6370e6117950ff62d6e339527e7472301c9c78a017978392 AS deps

WORKDIR /app

# Copier les manifestes en premier pour maximiser le cache Docker
COPY package*.json ./

# Outils de compilation pour les modules natifs (bcrypt, si aucun binaire
# précompilé ne correspond à la plateforme)
RUN apt-get update && apt-get install -y --no-install-recommends \
        python3 \
        make \
        g++ \
    && rm -rf /var/lib/apt/lists/*

# Installer uniquement les dépendances de prod
RUN npm ci --omit=dev --no-audit --no-fund


# ── Stage 2 : image finale ────────────────────────────────────────────────────
FROM node:22.23.3-bookworm-slim@sha256:c3de60bf2f9dd0ac6370e6117950ff62d6e339527e7472301c9c78a017978392 AS runner

# Dépendances runtime (pas de build tools)
RUN apt-get update && apt-get install -y --no-install-recommends \
        # Polices pour génération PDF (puppeteer-core + @sparticuz/chromium)
        libfontconfig1 \
        libfreetype6 \
        fonts-liberation \
        fonts-dejavu-core \
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

# Commit dont est issue l'image : exposé par GET /health (champ « version »)
# et vérifié par le déploiement (deploy/release.sh). Fourni par la chaîne :
#   docker build --build-arg GIT_SHA=<sha complet> ...
# « dev » pour une construction manuelle.
ARG GIT_SHA=dev
ENV GIT_SHA=${GIT_SHA}
LABEL org.opencontainers.image.title="nanei-api" \
      org.opencontainers.image.revision="${GIT_SHA}"

# Basculer vers l'utilisateur non-root (uid 1000, inclus dans node:slim)
USER node

EXPOSE 3000

# Healthcheck : interroge /health toutes les 30 s (la sonde vérifie aussi la
# base : 503 si PostgreSQL est injoignable)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -fsS http://localhost:3000/health > /dev/null || exit 1

CMD ["node", "src/server.js"]
