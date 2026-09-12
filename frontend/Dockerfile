# ARCH-003 — Image du frontend Angular (build + service statique nginx).
# Le SPA sert les assets et PROXY-FIE /api et /uploads vers l'API (URL
# relatives obligatoires — jamais de localhost absolu, voir environment.prod).

FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# FE-004 : la configuration « production » (défaut) injecte environment.prod.ts.
RUN npx ng build

FROM nginx:1.27-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/fluidity /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s \
  CMD wget -qO- http://127.0.0.1/ >/dev/null 2>&1 || exit 1
