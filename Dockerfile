# syntax=docker/dockerfile:1.7
# Zauberbuch – DnD 5e Spell Library
# Multi-Stage-Build: Frontend (Vite) + Backend (esbuild) bauen, schlankes Runtime-Image.

ARG NODE_IMAGE=node:lts-alpine

# ---------- Basis ----------
FROM ${NODE_IMAGE} AS base
WORKDIR /app
RUN apk add --no-cache openssl
ENV CHECKPOINT_DISABLE=1 \
    PRISMA_HIDE_UPDATE_MESSAGE=1 \
    NEXT_TELEMETRY_DISABLED=1

# ---------- Alle Abhängigkeiten (inkl. dev) ----------
FROM base AS deps
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

# ---------- Build ----------
FROM deps AS build
COPY . .
RUN npm run build

# ---------- Nur Produktionsabhängigkeiten des Servers ----------
FROM base AS prod-deps
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/
COPY server/prisma server/prisma
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --omit=peer --workspace server --include-workspace-root=false --no-audit --no-fund \
 && npx prisma generate --schema server/prisma/schema.prisma \
 && npm cache clean --force

# ---------- Runtime ----------
FROM base AS runtime
ARG APP_VERSION=1.0.0
LABEL org.opencontainers.image.title="Zauberbuch" \
      org.opencontainers.image.description="DnD 5e Spell Library – Zauber durchsuchen, filtern und im eigenen Zauberbuch sammeln" \
      org.opencontainers.image.version="${APP_VERSION}" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.source="https://github.com/JNDMNK/zauberbuch" \
      org.opencontainers.image.url="https://github.com/JNDMNK/zauberbuch" \
      net.unraid.docker.icon="https://raw.githubusercontent.com/JNDMNK/zauberbuch/main/client/public/icon.png" \
      net.unraid.docker.webui="http://[IP]:[PORT:8080]/"

RUN apk add --no-cache su-exec tzdata sqlite tini

ENV NODE_ENV=production \
    APP_VERSION=${APP_VERSION} \
    PUID=99 \
    PGID=100 \
    UMASK=022 \
    TZ=Europe/Berlin \
    PORT=8080 \
    DATA_DIR=/data \
    DATABASE_URL=file:/data/zauberbuch.db \
    DEFAULT_LANGUAGE=de \
    SEED_EXAMPLES=false \
    JWT_SECRET= \
    ADMIN_USERNAME= \
    ADMIN_PASSWORD=

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/server/package.json ./server/package.json
COPY --from=build /app/server/prisma ./server/prisma
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/client/dist ./client/dist
COPY docker/entrypoint.sh docker/start.sh /usr/local/bin/
RUN chmod 755 /usr/local/bin/entrypoint.sh /usr/local/bin/start.sh \
 && mkdir -p /data

VOLUME ["/data"]
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-8080}/api/health" > /dev/null || exit 1

ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/entrypoint.sh"]
CMD ["/usr/local/bin/start.sh"]
