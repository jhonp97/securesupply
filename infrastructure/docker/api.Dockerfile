# ─────────────────────────────────────────────
# Dockerfile — SecureSupply API (NestJS 11)
# ─────────────────────────────────────────────
# Multi-stage: builder + production
# Usuario no-root UID 1001
# ─────────────────────────────────────────────

# ═══════════════════════════════════════════════
# Stage 1: Builder — compila la API
# ═══════════════════════════════════════════════
FROM node:24.16.0-alpine AS builder

# Seguridad: usuario no-root para pnpm install
USER 1001

WORKDIR /app

# Copiar lockfile y manifiestos (layer cacheable)
COPY --chown=1001 pnpm-lock.yaml pnpm-workspace.yaml ./
COPY --chown=1001 package.json ./
COPY --chown=1001 apps/api/package.json ./apps/api/package.json
COPY --chown=1001 packages/ ./packages/

# Instalar dependencias (solo producción para builder mínimo)
RUN corepack enable && \
    pnpm install --frozen-lockfile --filter @securesupply/api

# Copiar código fuente
COPY --chown=1001 apps/api/ ./apps/api/
COPY --chown=1001 prisma.config.ts ./
COPY --chown=1001 apps/api/prisma/ ./apps/api/prisma/

# Compilar
RUN pnpm --filter @securesupply/api build

# ═══════════════════════════════════════════════
# Stage 2: Production — imagen final mínima
# ═══════════════════════════════════════════════
FROM node:24.16.0-alpine AS production

# Instalar herramientas de sistema necesarias para Prisma
RUN apk add --no-cache openssl ca-certificates

# Crear usuario no-root
RUN addgroup -g 1001 -S app && \
    adduser -u 1001 -S app -G app

WORKDIR /app

# Copiar artifacts del builder
COPY --from=builder --chown=1001:1001 /app/node_modules ./node_modules
COPY --from=builder --chown=1001:1001 /app/dist ./dist
COPY --from=builder --chown=1001:1001 /app/package.json ./
COPY --from=builder --chown=1001:1001 /app/prisma.config.ts ./
COPY --from=builder --chown=1001:1001 /app/apps/api/prisma ./apps/api/prisma

# Cambiar a usuario no-root
USER 1001

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "const http = require('http'); http.get('http://localhost:4000/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1));"

EXPOSE 4000

CMD ["node", "dist/main.js"]
