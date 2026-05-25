# SecureSupply

**Plataforma de análisis de seguridad en cadena de suministro de software.**

SecureSupply escanea repositorios de código en busca de vulnerabilidades de seguridad en dependencias, secretos expuestos, configuraciones inseguras y código malicioso. Proporciona una API REST, un worker de análisis asíncrono y un dashboard web.

## Requisitos

- **Node.js** >=24.16.0 <25.0.0 (LTS Krypton)
- **pnpm** 11.3.0
- **Docker** + Docker Compose (para infraestructura local)
- **Git** (para el worker de análisis)

## Stack

| Componente | Tecnología |
|------------|------------|
| Frontend | Next.js 16 (App Router, Turbopack) |
| API | NestJS 11 + Helmet + Zod |
| Worker | NestJS 11 + BullMQ |
| Base de datos | PostgreSQL 17 + Prisma 7 |
| Cache / Colas | Redis 8 |
| Paquete | pnpm 11 + Turborepo 2.9 |
| CI/CD | GitHub Actions |

## Inicio rápido

```bash
# 1. Clonar el repositorio
git clone <repo-url>
cd securityapp

# 2. Instalar dependencias
pnpm install

# 3. Configurar variables de entorno
cp .env.example .env
# Editar .env con los valores correspondientes

# 4. Iniciar servicios de infraestructura (PostgreSQL + Redis)
docker compose up -d

# 5. Generar Prisma Client
pnpm -w prisma generate

# 6. Ejecutar migraciones
pnpm -w prisma migrate dev

# 7. Verificar que todo compila
pnpm -r typecheck

# 8. Iniciar en desarrollo
pnpm dev
```

## Scripts disponibles

| Script | Descripción |
|--------|-------------|
| `pnpm dev` | Inicia todos los servicios en modo desarrollo |
| `pnpm build` | Compila todos los paquetes y apps |
| `pnpm -r typecheck` | Verifica tipos en todos los workspaces |
| `pnpm -r lint` | Ejecuta ESLint en todos los workspaces |
| `pnpm test` | Ejecuta tests en todos los workspaces |
| `pnpm -w prisma generate` | Genera Prisma Client |

## Estructura del proyecto

```
securityapp/
├── apps/
│   ├── api/          # NestJS 11 API REST
│   ├── web/          # Next.js 16 Frontend
│   └── worker/       # NestJS 11 Worker (BullMQ)
├── packages/
│   ├── config/       # Variables de entorno (Zod)
│   ├── eslint-config/# ESLint 10 flat config
│   ├── shared/       # Utilidades compartidas
│   ├── tsconfig/     # Configuración base de TypeScript
│   └── types/        # Schemas Zod y tipos compartidos
├── infrastructure/
│   └── docker/       # Dockerfiles
├── prisma.config.ts  # Configuración de Prisma 7
├── docker-compose.yml
└── turbo.json        # Turborepo 2.9
```

## Licencia

MIT — ver [LICENSE](LICENSE).
