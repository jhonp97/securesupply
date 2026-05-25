# ─────────────────────────────────────────────
# Dockerfile — SecureSupply Web (Next.js 16)
# ─────────────────────────────────────────────
# Multi-stage: builder + standalone runner
# Output standalone para imagen mínima
# Usuario no-root UID 1001
# ─────────────────────────────────────────────

# ═══════════════════════════════════════════════
# Stage 1: Builder — compila Next.js
# ═══════════════════════════════════════════════
FROM node:24.16.0-alpine AS builder

# Seguridad: usuario no-root para pnpm install
USER 1001

WORKDIR /app

# Copiar lockfile y manifiestos (layer cacheable)
COPY --chown=1001 pnpm-lock.yaml pnpm-workspace.yaml ./
COPY --chown=1001 package.json ./
COPY --chown=1001 apps/web/package.json ./apps/web/package.json
COPY --chown=1001 packages/ ./packages/

# Instalar dependencias
RUN corepack enable && \
    pnpm install --frozen-lockfile --filter @securesupply/web

# Copiar código fuente
COPY --chown=1001 apps/web/ ./apps/web/

# Build con output standalone
RUN pnpm --filter @securesupply/web build

# ═══════════════════════════════════════════════
# Stage 2: Runner — servidor standalone Next.js
# ═══════════════════════════════════════════════
FROM node:24.16.0-alpine AS runner

# Crear usuario no-root
RUN addgroup -g 1001 -S app && \
    adduser -u 1001 -S app -G app

WORKDIR /app

# Copiar el build standalone de Next.js (mínimo necesario para correr)
COPY --from=builder --chown=1001:1001 /app/apps/web/.next/standalone ./
COPY --from=builder --chown=1001:1001 /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=1001:1001 /app/apps/web/public ./apps/web/public

# Cambiar a usuario no-root
USER 1001

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "const http = require('http'); http.get('http://localhost:3000/api/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1));"

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

CMD ["node", "apps/web/server.js"]
