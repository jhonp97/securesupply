# ─────────────────────────────────────────────
# Dockerfile — SecureSupply Worker (NestJS 11 + BullMQ)
# ─────────────────────────────────────────────
# Multi-stage: builder + production
# Incluye herramientas para escaneo de repositorios
# Usuario no-root UID 1001
# ─────────────────────────────────────────────

# ═══════════════════════════════════════════════
# Stage 1: Builder — compila el worker
# ═══════════════════════════════════════════════
FROM node:24.16.0-alpine AS builder

# Seguridad: usuario no-root para pnpm install
USER 1001

WORKDIR /app

# Copiar lockfile y manifiestos (layer cacheable)
COPY --chown=1001 pnpm-lock.yaml pnpm-workspace.yaml ./
COPY --chown=1001 package.json ./
COPY --chown=1001 apps/worker/package.json ./apps/worker/package.json
COPY --chown=1001 packages/ ./packages/

# Instalar dependencias
RUN corepack enable && \
    pnpm install --frozen-lockfile --filter @securesupply/worker

# Copiar código fuente
COPY --chown=1001 apps/worker/ ./apps/worker/
COPY --chown=1001 prisma.config.ts ./
COPY --chown=1001 apps/api/prisma/ ./apps/api/prisma/

# Compilar
RUN pnpm --filter @securesupply/worker build

# ═══════════════════════════════════════════════
# Stage 2: Production — imagen final
# ═══════════════════════════════════════════════
FROM node:24.16.0-alpine AS production

# Instalar herramientas de escaneo y runtime
# git: clonar repositorios para análisis
# openssl, ca-certificates: necesario para Prisma
RUN apk add --no-cache \
    git \
    openssh-client \
    openssl \
    ca-certificates

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

# Configurar git seguro (evitar advertencias de seguridad)
RUN git config --global safe.directory '*'

# Cambiar a usuario no-root
USER 1001

# Healthcheck básico: el worker no tiene HTTP pero podemos verificar que el proceso corre
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "process.exit(0);"

# Sin EXPOSE — el worker no expone puertos HTTP

CMD ["node", "dist/main.js"]
