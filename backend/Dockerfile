# ARCH-003 — Image de production de l'API Fluidity.
# Principes : pas de devDependencies, utilisateur non-root, surface minimale.

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# Installation PRODUCTION uniquement (les outils QA/seed restent hors image).
RUN npm ci --omit=dev

FROM node:20-alpine
ENV NODE_ENV=production
WORKDIR /app

# Dépendances production de l'étape précédente.
COPY --from=deps /app/node_modules ./node_modules
COPY src ./src
COPY package.json ./

# Compte non-root (le serveur écoute un port > 1024).
RUN addgroup -S fluidity && adduser -S fluidity -G fluidity \
    && mkdir -p /app/uploads && chown -R fluidity:fluidity /app
USER fluidity

# Port interne ; le TLS est terminé par le reverse-proxy (voir runbook).
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
  CMD wget -qO- http://127.0.0.1:3000/health >/dev/null 2>&1 || exit 1

CMD ["node", "src/server.js"]
