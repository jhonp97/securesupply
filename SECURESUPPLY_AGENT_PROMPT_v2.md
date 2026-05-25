# SecureSupply MVP — Agent Orchestration Prompt for OpenCode

> **⚠️ DOCUMENTO DE INSTRUCCIONES PARA EL AGENTE — LEER ANTES DE EJECUTAR CUALQUIER COSA**
>
> Este no es un README normal. Este documento es un **prompt estructurado para un agente de codificación IA**.
> Cada sección contiene reglas vinculantes, criterios de aceptación y contratos de ejecución.
> El agente DEBE leer este documento completo antes de escribir una sola línea de código.
> El incumplimiento de cualquier regla marcada como `[HARD RULE]` es motivo de autocorrección inmediata.

---

## Tabla de Contenidos

1. [Mission Statement](#1-mission-statement)
2. [Hard Rules — Restricciones No Negociables](#2-hard-rules--restricciones-no-negociables)
3. [Architecture Overview](#3-architecture-overview)
4. [Tech Stack — Versiones Canónicas](#4-tech-stack--versiones-canónicas)
5. [Security Model](#5-security-model)
6. [Scanner Pipeline & Risk Score Engine](#6-scanner-pipeline--risk-score-engine)
7. [Data Model (Prisma 7)](#7-data-model-prisma-7)
8. [API Contract (NestJS)](#8-api-contract-nestjs)
9. [Phase Execution Plan](#9-phase-execution-plan)
10. [Acceptance Criteria per Phase](#10-acceptance-criteria-per-phase)
11. [Agent Communication Protocol](#11-agent-communication-protocol)
12. [Anti-Patterns — Lo que NUNCA hay que hacer](#12-anti-patterns--lo-que-nunca-hay-que-hacer)
13. [Apéndice A — Comandos de Setup Local](#apéndice-a--comandos-de-setup-local)
14. [Apéndice B — Configuración de la GitHub App](#apéndice-b--configuración-de-la-github-app)
15. [Apéndice C — Especificaciones de Dockerfiles](#apéndice-c--especificaciones-de-dockerfiles)
16. [Apéndice D — Contenido de SECURITY.md](#apéndice-d--contenido-de-securitymd)
17. [Apéndice E — Contenido de CONTRIBUTING.md](#apéndice-e--contenido-de-contributingmd)
18. [Apéndice F — Contenido de LICENSE](#apéndice-f--contenido-de-license)

---

## 1. Mission Statement

**SecureSupply** es una **plataforma de análisis de seguridad de la cadena de suministro, self-hosted, gratuita y automatizada** para repositorios de GitHub, enfocada en ecosistemas JavaScript/TypeScript (`npm`/`pnpm`).

### Qué hace

- Analiza repositorios de GitHub **sin instalar dependencias** (solo análisis estático)
- Detecta CVEs conocidos, dependencias vulnerables/abandonadas, scripts de instalación peligrosos, secretos expuestos, workflows de GitHub Actions inseguros y riesgos en dependencias transitivas
- Presenta los hallazgos en un dashboard unificado con un **Risk Score** calculado
- Funciona completamente en `localhost` — sin dependencia de SaaS externo para el MVP
- Emite actualizaciones de estado en tiempo real vía **Server-Sent Events (SSE)**

### Qué NO es

- ❌ Una nueva base de datos CVE ni motor SAST
- ❌ Un reemplazo de Snyk, Dependabot o GitHub Advanced Security
- ✅ Un **orquestador** de herramientas open-source maduras: Trivy, osv-scanner, Semgrep, Gitleaks
- ✅ Un **correlacionador** que centraliza hallazgos de múltiples scanners en un único informe accionable

---

## 2. Hard Rules — Restricciones No Negociables

El agente DEBE aplicar estas reglas en cada archivo, en cada fase, sin excepción.

### [HARD RULE] Idioma del Agente

```
TODA la comunicación del agente con el usuario DEBE ser en ESPAÑOL.
Esto incluye: mensajes de estado, confirmaciones de fase, descripciones de archivos,
preguntas, advertencias, errores y cualquier texto que el agente muestre al usuario.

Los nombres de variables, funciones, clases y rutas permanecen en inglés
(convención técnica universal).

LOS COMENTARIOS EN EL CÓDIGO DEBEN ESTAR EN ESPAÑOL.
Esto es obligatorio en todos los archivos de todos los packages y apps.
```

Ejemplo correcto de comentario:

```typescript
// Valida la firma HMAC del webhook antes de procesar el payload
// Si la firma no coincide, se rechaza con HTTP 401
const isValid = await webhooks.verify(payload, signature);
```

Ejemplo incorrecto (PROHIBIDO):

```typescript
// Validates HMAC signature before processing webhook payload
const isValid = await webhooks.verify(payload, signature);
```

### [HARD RULE] Lenguaje de Código

```
TODO el código DEBE ser TypeScript con strict mode habilitado.
Los archivos JavaScript planos (.js) están PROHIBIDOS en /apps y /packages.
```

`tsconfig.json` base debe incluir:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "types": ["node"]
  }
}
```

> **Nota TypeScript 6.0:** En TS 6, el campo `types` ya no auto-descubre los tipos globales.
> Se debe declarar `"types": ["node"]` explícitamente en todos los tsconfig de apps y worker.
> `baseUrl` está deprecado — usar `paths` directamente sin depender de `baseUrl`.

### [HARD RULE] Package Manager

```
SOLO se permite pnpm. npm y yarn están PROHIBIDOS.
Todas las instalaciones deben usar: pnpm install --frozen-lockfile
Todas las versiones de paquetes deben ser EXACTAS (sin prefijos ^ o ~).
El archivo .npmrc raíz debe contener save-exact=true.
```

### [HARD RULE] Seguridad — Aislamiento del Análisis

```
NUNCA ejecutar npm install, pnpm install o yarn en los repositorios analizados.
PROHIBIDO ejecutar scripts postinstall, preinstall o prepare de repos externos.
PROHIBIDO ejecutar workflows CI/CD o código arbitrario de repos clonados.
TODOS los clones deben escribirse en /tmp/securesupply-scan-{uuid}/ y
eliminarse inmediatamente después de que el pipeline de escaneo termine,
independientemente del resultado (éxito o error), usando bloque finally.
El tamaño del repositorio se verifica ANTES del clone: si supera MAX_REPO_SIZE_MB
(configurable, default 500 MB), el scan se cancela con ScanStatus.CANCELLED.
```

### [HARD RULE] Manejo de Secretos

```
NUNCA escribir secretos, tokens o API keys en texto plano en logs, archivos o stdout.
TODOS los secretos deben estar enmascarados en el logger Pino con configuración redact.
Los tokens de GitHub y las claves privadas de la app deben cargarse SOLO desde variables de entorno.
NUNCA almacenar tokens de instalación de GitHub en base de datos.
```

### [HARD RULE] Validación de Input

```
TODOS los inputs externos (payloads HTTP, cuerpos de webhooks, variables de entorno, rutas de archivos)
DEBEN validarse con esquemas Zod ANTES de ser procesados por cualquier lógica de negocio.
Un input no validado que llega a la lógica de negocio es un bug crítico.
```

### [HARD RULE] Actualizaciones en Tiempo Real — SSE, NO polling

```
Las actualizaciones de estado de un scan en curso DEBEN implementarse via Server-Sent Events (SSE).
El endpoint es: GET /api/v1/scans/:id/events
El frontend (apps/web) DEBE consumir este endpoint con EventSource o React Query con SSE adapter.
PROHIBIDO usar React Query con refetchInterval para el estado de scans en curso.
PROHIBIDO usar setInterval o setTimeout para polling de estado.
El anti-pattern de "polling con setTimeout/setInterval" aplica también a React Query refetchInterval.
```

### [HARD RULE] Diseño Visual — No Genérico

```
El dashboard web (apps/web) NO debe tener apariencia genérica ni de plantilla estándar.
Está PROHIBIDO usar los estilos por defecto de shadcn/ui sin personalización.
El diseño debe transmitir identidad propia: paleta de colores definida, tipografía coherente,
jerarquía visual clara y componentes adaptados al dominio de seguridad.
```

Directrices de diseño obligatorias para `apps/web`:

- **Paleta:** Fondo oscuro (`#0a0e1a` o similar), acentos en cian/verde eléctrico para estados OK, rojo para crítico, ámbar para advertencias
- **Tipografía:** Fuente monospace para IDs de CVE, hashes y rutas de archivos; sans-serif moderna para texto UI
- **Risk Score:** Gauge radial animado con gradiente de color según nivel (verde → ámbar → rojo)
- **Findings table:** Badges de severidad con color sólido y contraste alto, no solo texto
- **Estado de scan en tiempo real:** Indicador de progreso visual alimentado por SSE — spinner o barra animada
- **Sidebar:** Navegación con iconos descriptivos que refuercen el contexto de seguridad
- La UI debe evocar una herramienta de seguridad profesional (estilo terminal/security dashboard), no un SaaS genérico

### [HARD RULE] Docker — Seguridad de Contenedores

```
TODOS los Dockerfiles deben usar multi-stage build.
La imagen final NUNCA debe incluir herramientas de build, node_modules de desarrollo ni caché.
TODOS los contenedores deben correr como usuario no-root.
El usuario debe crearse con UID/GID fijo (1001) para reproducibilidad.
Ver Apéndice C para la especificación exacta de cada Dockerfile.
```

---

## 3. Architecture Overview

### Estructura del Monorepo

```
securesupply/
├── apps/
│   ├── web/                    # Next.js 16 — dashboard profesional (App Router)
│   ├── api/                    # NestJS REST API + SSE
│   └── worker/                 # BullMQ scan worker (app NestJS standalone)
├── packages/
│   ├── shared/                 # Utilidades cross-app, constantes, helpers
│   ├── types/                  # Tipos TypeScript compartidos y esquemas Zod
│   ├── config/                 # Cargador de configuración en runtime con Zod
│   ├── eslint-config/          # ESLint flat config compartido
│   └── tsconfig/               # Configuraciones base de TypeScript
├── infrastructure/
│   ├── docker/                 # Dockerfiles por servicio (multi-stage, non-root)
│   └── scripts/                # Scripts de seed, migración y setup
├── .github/
│   ├── workflows/
│   │   ├── ci.yml              # CI: lint + typecheck + tests en cada PR
│   │   ├── e2e.yml             # E2E tests en merge a main
│   │   └── security-scan.yml   # Auto-scan del propio repo con SecureSupply
│   └── PULL_REQUEST_TEMPLATE.md
├── pnpm-workspace.yaml
├── .npmrc                      # save-exact=true
├── package.json                # Raíz — solo herramientas de desarrollo
├── docker-compose.yml
├── docker-compose.test.yml     # Compose para tests de integración
├── prisma.config.ts            # Configuración de Prisma 7 (url fuera del schema)
├── .env.example
├── LICENSE                     # MIT
├── SECURITY.md                 # Política de responsible disclosure
├── CONTRIBUTING.md             # Guía de contribución
└── turbo.json                  # Pipeline de tareas Turborepo
```

### Arquitectura del Sistema (C4 Nivel 2)

```
┌─────────────────────────────────────────────────────────────────┐
│                     Máquina del Desarrollador                    │
│                                                                 │
│  ┌──────────┐   HTTP    ┌──────────────────────────────────┐   │
│  │ Navegador│──────────▶│   Next.js Web App (:3000)        │   │
│  └──────────┘           └──────────────┬─────────────────  ┘   │
│         ▲  SSE                         │ REST API               │
│         └────────────────────          │                        │
│                         ┌──────────────▼───────────────────┐   │
│                         │  NestJS API Server (:4000)        │   │
│                         │  • REST endpoints                 │   │
│                         │  • GET /scans/:id/events (SSE)    │   │
│                         │  • CORS restringido a :3000       │   │
│                         └──────┬───────────────┬────────────┘   │
│                                │               │                │
│                    ┌───────────▼──┐    ┌───────▼────────────┐  │
│                    │  PostgreSQL  │    │  Redis (BullMQ)    │  │
│                    │  (Prisma 7)  │    │  Queue + ScanState │  │
│                    └─────────────┘    └───────┬────────────┘  │
│                                               │                │
│                         ┌─────────────────────▼──────────┐    │
│                         │   BullMQ Worker (:4001)         │    │
│                         │   concurrency: WORKER_CONCURR.  │    │
│                         │                                 │    │
│                         │  ┌─────┐ ┌───┐ ┌──────┐        │    │
│                         │  │Trivy│ │OSV│ │Semgr.│        │    │
│                         │  └──┬──┘ └─┬─┘ └──┬───┘        │    │
│                         │    └───────┴──────┘             │    │
│                         │  ┌──────────┐  timeout: 300s    │    │
│                         │  │ Gitleaks │  por scanner      │    │
│                         │  └──────────┘                   │    │
│                         │                                 │    │
│                         │  /tmp/scan-{uuid}/  ←──┐        │    │
│                         │  [CLON EFÍMERO]         │        │    │
│                         │  size check → clone ────┘        │    │
│                         │  rm -rf (finally)                │    │
│                         └─────────────────────────────────┘    │
│                                                                 │
│  Externo: GitHub App webhooks → /api/v1/webhooks/github         │
└─────────────────────────────────────────────────────────────────┘
```

### Flujo de Datos — Scan + SSE

```
Evento GitHub (push / PR)  ──o──  Trigger manual desde UI
        │
        ▼
[POST /api/webhooks/github]
  Validación Zod + verificación firma HMAC
        │
        ▼
[ScanJob creado en PostgreSQL con status PENDING]
[Estado inicial cacheado en Redis: scan:{id}:status = PENDING]
        │
        ▼
[Job BullMQ encolado → scan-queue]
[Redis actualizado: status = QUEUED]
        │
        ▼
[Worker procesa el job]
  0. Verificar tamaño del repo vía GitHub API — abortar si > MAX_REPO_SIZE_MB
  1. git clone --depth=1 → /tmp/securesupply-scan-{uuid}/
  2. Redis: status = RUNNING, progress = { step: 'trivy', pct: 0 }
  3. Ejecutar Trivy (timeout 300s, salida JSON)
  4. Redis: progress = { step: 'osv', pct: 25 }
  5. Ejecutar osv-scanner (timeout 300s, salida JSON)
  6. Redis: progress = { step: 'semgrep', pct: 50 }
  7. Ejecutar Semgrep (timeout 300s, salida JSON)
  8. Redis: progress = { step: 'gitleaks', pct: 75 }
  9. Ejecutar Gitleaks (timeout 300s, salida JSON)
  10. Parsear y normalizar todas las salidas
  11. Calcular Risk Score (modelo acumulativo)
  12. Persistir ScanResult + Findings → PostgreSQL
  13. Redis: status = COMPLETED/FAILED, progress = { pct: 100 }
  14. rm -rf /tmp/securesupply-scan-{uuid}/   ← finally, siempre
        │
        ▼
[SSE endpoint GET /api/v1/scans/:id/events]
  Lee estado desde Redis (baja latencia)
  Emite eventos: { type: 'status', data: { status, progress } }
  El cliente (EventSource) actualiza la UI sin polling
```

---

## 4. Tech Stack — Versiones Canónicas

El agente debe usar **exactamente** estas versiones. No actualizar ni sustituir sin instrucción explícita.

### Herramientas Raíz

| Herramienta | Versión | Notas |
|---|---|---|
| Node.js | `24.x LTS` | Motor requerido. `engines: { node: ">=24" }` |
| pnpm | `11.x` | Campo `packageManager` en package.json raíz. NUNCA npm |
| TypeScript | `6.x` | Strict mode. Requiere ajustes de tsconfig (ver §2) |
| Turborepo | `2.9` | Orquestación de tareas |
| ESLint | `10.x` | Formato flat config |
| Prettier | `3.x` | Config compartida en packages/eslint-config |

### apps/api (NestJS Backend)

| Paquete | Versión | Propósito |
|---|---|---|
| `@nestjs/core` | `11.x` | Framework |
| `@nestjs/platform-express` | `11.x` | Adaptador HTTP |
| `@nestjs/jwt` | `11.x` | Auth JWT |
| `@nestjs/swagger` | `11.x` | Docs OpenAPI |
| `@nestjs/throttler` | `6.x` | Rate limiting |
| `zod` | `4.x` | Validación de input |
| `pino` | `10.x` | Logger estructurado |
| `pino-http` | `10.x` | Logging de requests HTTP |
| `pino-pretty` | `13.x` | Formateo de logs en dev |
| `helmet` | `8.x` | Security headers HTTP |
| `@octokit/rest` | `22.x` | Cliente GitHub API |
| `@octokit/webhooks` | `14.x` | Verificación de webhooks |

### apps/worker (BullMQ Worker)

| Paquete | Versión | Propósito |
|---|---|---|
| `bullmq` | `5.x` | Cola de jobs |
| `ioredis` | `5.x` | Cliente Redis |
| `simple-git` | `3.x` | Operaciones Git (sin shell exec) |
| `zod` | `4.x` | Validación de payload de jobs |

### apps/web (Next.js Frontend)

| Paquete | Versión | Propósito |
|---|---|---|
| `next` | `16.x` | App Router |
| `@tanstack/react-query` | `5.x` | Estado del servidor (sin refetchInterval para scans activos) |
| `zustand` | `5.x` | Estado del cliente |
| `tailwindcss` | `4.x` | Estilos |
| `shadcn/ui` | `latest` | Librería de componentes (REQUIERE personalización de tema) |
| `recharts` | `3.x` | Gráficos de Risk Score |

### Base de Datos e Infraestructura

| Herramienta | Versión | Notas |
|---|---|---|
| PostgreSQL | `17.x` | Imagen Docker `postgres:17-alpine` (estable y probado) |
| Redis | `8.x` | Imagen Docker `redis:8-alpine` |
| Prisma | `7.x` | ORM + migraciones. **url en prisma.config.ts, no en schema.prisma** |
| `@prisma/adapter-pg` | `7.x` | Driver adapter obligatorio en Prisma 7 |
| `pg` | `8.x` | Driver PostgreSQL nativo |
| Docker Compose | `v2` | Formato de archivo Compose `3.9` |

### Testing

| Paquete | Versión | Propósito |
|---|---|---|
| `vitest` | `3.x` | Tests unitarios e integración (ESM nativo) |
| `@nestjs/testing` | `11.x` | Módulos de test NestJS |
| `supertest` | `7.x` | Tests HTTP |
| `testcontainers` | `10.x` | PostgreSQL/Redis reales en integración |
| `@faker-js/faker` | `9.x` | Datos de prueba |
| `playwright` | `1.x` | Tests E2E del dashboard |

---

## 5. Security Model

### Autenticación con GitHub App

```
GitHub App (creada por el usuario en configuración de GitHub)
├── Clave Privada (.pem) → variable de entorno GITHUB_APP_PRIVATE_KEY
├── App ID            → variable de entorno GITHUB_APP_ID
├── Webhook Secret    → variable de entorno GITHUB_WEBHOOK_SECRET
└── Installation Token → generado por petición vía Octokit, NUNCA almacenado
```

La API debe:

1. Verificar la firma del webhook usando `@octokit/webhooks` — rechazar si inválida (HTTP 401)
2. Generar tokens de instalación de corta duración vía `createInstallationAccessToken`
3. Nunca almacenar tokens de GitHub en la base de datos
4. Verificar el tamaño del repo con la GitHub API ANTES de clonar

### Variables de Entorno

Todos los secretos se cargan vía `packages/config`, que los valida al arranque con Zod:

```typescript
// packages/config/src/env.schema.ts
import { z } from 'zod';

// Esquema de validación de variables de entorno obligatorias
export const EnvSchema = z.object({
  DATABASE_URL:            z.string().url(),
  REDIS_URL:               z.string().url(),
  JWT_SECRET:              z.string().min(32),
  REFRESH_TOKEN_SECRET:    z.string().min(32),
  GITHUB_APP_ID:           z.string().min(1),
  // Acepta claves RSA PKCS#1 ("BEGIN RSA PRIVATE KEY") y PKCS#8 ("BEGIN PRIVATE KEY")
  GITHUB_APP_PRIVATE_KEY:  z.string().refine(
    (k) => k.includes('BEGIN RSA PRIVATE KEY') || k.includes('BEGIN PRIVATE KEY'),
    { message: 'Debe ser una clave privada PEM válida (RSA PKCS#1 o PKCS#8)' }
  ),
  GITHUB_WEBHOOK_SECRET:   z.string().min(20),
  NODE_ENV:                z.enum(['development', 'production', 'test']),
  // Puerto de la API — default 4000
  PORT:                    z.coerce.number().default(4000),
  // URL del frontend para configuración de CORS
  FRONTEND_URL:            z.string().url().default('http://localhost:3000'),
  // Límites operacionales — con defaults seguros
  SCANNER_TIMEOUT_MS:      z.coerce.number().default(300_000),   // 5 minutos por scanner
  MAX_REPO_SIZE_MB:        z.coerce.number().default(500),        // 500 MB máximo
  WORKER_CONCURRENCY:      z.coerce.number().min(1).max(8).default(2),
});

export type Env = z.infer<typeof EnvSchema>;
```

Si la validación falla al arrancar, el proceso debe terminar con código 1 y un mensaje de error claro que indique exactamente qué campo falta o es inválido.

### CORS — Configuración Obligatoria en NestJS

```typescript
// apps/api/src/main.ts
// Configuración de CORS restrictiva: solo permite el frontend definido en .env
app.enableCors({
  origin: env.FRONTEND_URL,           // ej. 'http://localhost:3000'
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id'],
  exposedHeaders: ['x-request-id'],
  credentials: true,                  // permite cookies de sesión
  maxAge: 86400,                      // preflight cache 24h
});
// NUNCA usar origin: '*' — es un fallo de seguridad crítico
```

### Seguridad del Clon Temporal

```typescript
// apps/worker/src/scanner/clone.service.ts — comportamiento requerido
const directorioEscaneo = `/tmp/securesupply-scan-${randomUUID()}`;

// Verificar tamaño del repo antes de clonar (via GitHub API)
const repoInfo = await githubClient.repos.get({ owner, repo });
const tamanioMB = repoInfo.data.size / 1024; // GitHub devuelve KB
if (tamanioMB > env.MAX_REPO_SIZE_MB) {
  throw new RepoTooLargeError(
    `Repositorio de ${tamanioMB.toFixed(1)} MB supera el límite de ${env.MAX_REPO_SIZE_MB} MB`
  );
}

try {
  // Clonar de forma superficial para minimizar datos descargados
  await git.clone(repoUrl, directorioEscaneo, ['--depth=1', '--no-tags']);
  // ... ejecutar scanners con timeout
} finally {
  // OBLIGATORIO: siempre se ejecuta, incluso en caso de error o timeout
  await fs.rm(directorioEscaneo, { recursive: true, force: true });
}
```

### Lock de Scan Concurrente por Repositorio

```typescript
// Antes de crear un nuevo ScanJob, verificar si ya hay uno RUNNING o QUEUED
// para el mismo repositorio. Si lo hay, rechazar con HTTP 409 Conflict.
const scanActivo = await prisma.scanJob.findFirst({
  where: {
    repositoryId,
    status: { in: ['PENDING', 'QUEUED', 'RUNNING'] },
  },
});
if (scanActivo) {
  throw new ConflictException(
    `El repositorio ya tiene un scan en curso (ID: ${scanActivo.id})`
  );
}
```

### Enmascaramiento de Secretos en Pino

```typescript
// Configuración del logger con redacción de datos sensibles
const logger = pino({
  redact: {
    paths: [
      '*.token', '*.secret', '*.password', '*.privateKey',
      'req.headers.authorization', 'req.headers.cookie',
      '*.installationToken', '*.accessToken', '*.refreshToken',
    ],
    censor: '[REDACTADO]',
  },
});
```

### Configuración de Helmet (Security Headers)

```typescript
// apps/api/src/main.ts
// Helmet con configuración explícita — no usar defaults sin revisar
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'"],
      styleSrc:   ["'self'", "'unsafe-inline'"],
      imgSrc:     ["'self'", 'data:'],
      connectSrc: ["'self'"],
      fontSrc:    ["'self'"],
      objectSrc:  ["'none'"],
      frameSrc:   ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // SSE requiere que sea false
  hsts: { maxAge: 31536000, includeSubDomains: true },
}));
```

---

## 6. Scanner Pipeline & Risk Score Engine

### Contrato de Ejecución de Scanners

Cada scanner debe implementarse como una clase que implemente `IScanner`:

```typescript
// packages/types/src/scanner.types.ts

// Resultado normalizado de cualquier scanner
export interface ScannerResult {
  scanner: 'trivy' | 'osv-scanner' | 'semgrep' | 'gitleaks';
  findings: NormalizedFinding[];
  rawOutput: unknown;         // conservado para depuración
  executionTimeMs: number;
  exitCode: number;
  timedOut: boolean;          // true si se agotó el timeout de 300s
}

// Hallazgo individual normalizado
export interface NormalizedFinding {
  id: string;                 // CVE-ID, ID de regla, o tipo de secreto
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  title: string;
  description: string;
  location?: {
    file: string;
    line?: number;
  };
  metadata: Record<string, unknown>;
}

// Contrato que todo scanner debe implementar
export interface IScanner {
  name: string;
  // repoPath debe validarse como subdirectorio de /tmp/securesupply-scan-*
  run(repoPath: string, timeoutMs: number): Promise<ScannerResult>;
}
```

### Comandos de Scanners

> **CRÍTICO:** Todos los scanners deben invocarse vía `child_process.execFile` con la ruta del binario,
> **nunca** vía `exec` con interpolación de string de shell. Todas las rutas deben validarse como
> subdirectorios de `/tmp/securesupply-scan-*` antes de la ejecución.
> Cada scanner recibe el timeout configurado en `SCANNER_TIMEOUT_MS` (default 300 000 ms).

```bash
# Trivy — escaneo de sistema de archivos, salida JSON
trivy fs --format json --output /tmp/trivy-result-{uuid}.json \
  --security-checks vuln,secret {repoPath}

# osv-scanner — escaneo de lockfiles
osv-scanner --format json --recursive {repoPath}

# Semgrep — reglas JS/TS
semgrep --config p/javascript --config p/typescript --json {repoPath}

# Gitleaks — detección de secretos
gitleaks detect --source {repoPath} \
  --report-format json --report-path /tmp/gitleaks-result-{uuid}.json --no-git
```

Los archivos de resultado en `/tmp/trivy-result-{uuid}.json` y `/tmp/gitleaks-result-{uuid}.json`
deben eliminarse en el bloque `finally`, junto con el directorio de clone.

### Validación de Path — Anti Path Traversal

```typescript
// packages/shared/src/path-validator.ts
import path from 'path';

// Verifica que repoPath sea un subdirectorio seguro de /tmp/securesupply-scan-*
export function validarRutaSegura(repoPath: string): void {
  const normalizada = path.resolve(repoPath);
  const prefijo = '/tmp/securesupply-scan-';
  if (!normalizada.startsWith(prefijo)) {
    throw new Error(
      `Path traversal detectado: "${normalizada}" no es un directorio de scan válido`
    );
  }
}
```

### Cálculo del Risk Score

```typescript
// packages/shared/src/risk-score.ts

// Tabla de pesos para el cálculo acumulativo del risk score
export const RISK_WEIGHTS = {
  CVE_CRITICAL:         50,
  CVE_HIGH:             40,
  CVE_MEDIUM:           20,
  CVE_LOW:              10,
  POSTINSTALL_SCRIPT:   25,
  CURL_BASH_PATTERN:    30,
  SECRET_FOUND:         50,
  UNSAFE_WORKFLOW:      20,
  ABANDONED_DEPENDENCY: 15,
} as const;

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export function calculateRiskScore(findings: NormalizedFinding[]): {
  score: number;
  level: RiskLevel;
} {
  // El score es acumulativo, con máximo en 100
  const raw = findings.reduce((acc, f) => acc + mapFindingToWeight(f), 0);
  const score = Math.min(raw, 100);

  // Umbrales de nivel de riesgo
  const level: RiskLevel =
    score >= 70 ? 'CRITICAL' :
    score >= 50 ? 'HIGH'     :
    score >= 30 ? 'MEDIUM'   : 'LOW';

  return { score, level };
}
```

Umbrales de score:

| Score | Nivel    | Color de Badge |
|-------|----------|----------------|
| 0–29  | LOW      | 🟢 Verde       |
| 30–49 | MEDIUM   | 🟡 Amarillo    |
| 50–69 | HIGH     | 🟠 Naranja     |
| 70–100| CRITICAL | 🔴 Rojo        |

---

## 7. Data Model (Prisma 7)

> **CRÍTICO — Prisma 7 Breaking Change:**
> La URL de conexión ya NO va en el bloque `datasource` del schema.
> Debe configurarse en `prisma.config.ts` en la raíz del monorepo.
> El adaptador `@prisma/adapter-pg` es obligatorio en Prisma 7.

### prisma.config.ts (raíz del monorepo)

```typescript
// prisma.config.ts
// Configuración de Prisma 7 — la URL sale del schema y va aquí
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'apps/api/prisma/schema.prisma',
  migrations: {
    path: 'apps/api/prisma/migrations',
  },
  datasource: {
    // La URL se lee desde el entorno — nunca hardcodeada
    url: env('DATABASE_URL'),
  },
});
```

### Inicialización del PrismaClient con Driver Adapter

```typescript
// apps/api/src/database/prisma.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    // Prisma 7 requiere el adapter explícito
    const pool = new Pool({ connectionString: process.env['DATABASE_URL'] });
    const adapter = new PrismaPg(pool);
    super({ adapter });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
```

### schema.prisma

```prisma
// apps/api/prisma/schema.prisma
// NOTA: en Prisma 7, la url del datasource se configura en prisma.config.ts
// NO incluir url = env("DATABASE_URL") aquí

generator client {
  provider = "prisma-client-js"
  output   = "../../../node_modules/.prisma/client"
}

datasource db {
  provider = "postgresql"
  // Sin campo 'url' — se gestiona en prisma.config.ts
}

model User {
  id           String        @id @default(cuid())
  email        String        @unique
  passwordHash String
  role         Role          @default(VIEWER)
  repositories Repository[]
  refreshTokens RefreshToken[]
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
  deletedAt    DateTime?     // soft delete

  @@index([email])
}

model RefreshToken {
  id        String   @id @default(cuid())
  token     String   @unique
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  expiresAt DateTime
  revokedAt DateTime? // para detección de reuse attack
  createdAt DateTime @default(now())

  @@index([userId])
  @@index([token])
}

model Repository {
  id              String     @id @default(cuid())
  githubId        Int        @unique
  fullName        String     // "owner/repo"
  defaultBranch   String
  isPrivate       Boolean
  installationId  Int
  owner           User       @relation(fields: [ownerId], references: [id])
  ownerId         String
  scans           ScanJob[]
  createdAt       DateTime   @default(now())
  updatedAt       DateTime   @updatedAt
  deletedAt       DateTime?

  @@index([ownerId])
  @@index([githubId])
}

model ScanJob {
  id           String      @id @default(cuid())
  repository   Repository  @relation(fields: [repositoryId], references: [id])
  repositoryId String
  status       ScanStatus  @default(PENDING)
  triggerType  TriggerType
  gitRef       String      // rama o commit SHA
  result       ScanResult?
  errorMessage String?
  retryCount   Int         @default(0)
  startedAt    DateTime?
  completedAt  DateTime?
  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt

  @@index([repositoryId])
  @@index([status])
}

model ScanResult {
  id          String    @id @default(cuid())
  scanJob     ScanJob   @relation(fields: [scanJobId], references: [id])
  scanJobId   String    @unique
  riskScore   Int
  riskLevel   RiskLevel
  findings    Finding[]
  summary     Json      // { total, bySeverity, byScanner }
  createdAt   DateTime  @default(now())
}

model Finding {
  id           String     @id @default(cuid())
  scanResult   ScanResult @relation(fields: [scanResultId], references: [id])
  scanResultId String
  scanner      ScannerType
  severity     Severity
  findingId    String     // ID de CVE, nombre de regla, etc.
  title        String
  description  String     @db.Text
  filePath     String?
  lineNumber   Int?
  metadata     Json
  createdAt    DateTime   @default(now())

  @@index([scanResultId])
  @@index([severity])
  @@index([scanner])
}

enum Role        { ADMIN ANALYST VIEWER }
enum ScanStatus  { PENDING QUEUED RUNNING COMPLETED FAILED CANCELLED }
enum TriggerType { MANUAL WEBHOOK_PUSH WEBHOOK_PR SCHEDULED }
enum RiskLevel   { LOW MEDIUM HIGH CRITICAL }
enum Severity    { CRITICAL HIGH MEDIUM LOW INFO }
enum ScannerType { TRIVY OSV_SCANNER SEMGREP GITLEAKS }
```

---

## 8. API Contract (NestJS)

### Base URL: `http://localhost:4000/api/v1`

### Swagger UI: `http://localhost:4000/api/docs`

#### Autenticación

```
POST   /auth/register           Crear cuenta de usuario local
POST   /auth/login              Devuelve JWT access token (1h) + refresh token (7d, cookie httpOnly)
POST   /auth/refresh            Renovar access token
DELETE /auth/logout             Revocar refresh token
```

#### Repositorios

```
GET    /repositories            Listar repos conectados del usuario (paginado)
POST   /repositories            Conectar un repositorio de GitHub
GET    /repositories/:id        Obtener detalles del repositorio
DELETE /repositories/:id        Desconectar repositorio
POST   /repositories/:id/scan   Disparar escaneo manual (respeta lock concurrente)
```

#### Scans

```
GET    /scans                   Listar todos los scans (paginado, filtrable por estado/repo)
GET    /scans/:id               Obtener detalles del scan + estado actual
GET    /scans/:id/findings      Obtener findings paginados de un scan
GET    /scans/:id/report        Descargar informe del scan (JSON)
GET    /scans/:id/events        SSE stream — emite eventos de progreso en tiempo real
                                Content-Type: text/event-stream
                                Eventos: { type: 'status', data: ScanProgressEvent }
                                         { type: 'complete', data: ScanCompleteEvent }
                                         { type: 'error', data: ScanErrorEvent }
                                El stream se cierra automáticamente al completar el scan
```

#### Webhooks

```
POST   /webhooks/github         Receptor de webhooks de GitHub App
                                Valida firma HMAC — 401 si inválida
                                Acepta: eventos push, pull_request
                                Encola job de escaneo en eventos válidos
```

#### Health

```
GET    /health                  { status, db, redis, version, uptime }
GET    /health/ready            Readiness probe para Docker
```

### Tipos de Eventos SSE

```typescript
// packages/types/src/sse.types.ts

// Evento emitido durante el progreso del scan
export interface ScanProgressEvent {
  scanId:   string;
  status:   'PENDING' | 'QUEUED' | 'RUNNING';
  progress: {
    step:    'clone' | 'trivy' | 'osv' | 'semgrep' | 'gitleaks' | 'normalize';
    pct:     number;  // 0-100
  };
}

// Evento final al completar el scan con éxito
export interface ScanCompleteEvent {
  scanId:    string;
  status:    'COMPLETED';
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

// Evento final en caso de error
export interface ScanErrorEvent {
  scanId:  string;
  status:  'FAILED' | 'CANCELLED';
  reason:  string;
}
```

---

## 9. Phase Execution Plan

> **INSTRUCCIÓN AL AGENTE:** Ejecutar las fases secuencialmente. NO iniciar una nueva fase antes de
> completar todas las tareas de la fase actual. Después de cada fase, mostrar un resumen de
> finalización **en español** y DETENERSE. Esperar confirmación explícita antes de continuar.

---

### FASE 1 — Inicialización del Monorepo

**Objetivo:** Esqueleto de monorepo completamente funcional y compilable, con todos los archivos de proyecto raíz.

Tareas:

1. Crear `package.json` raíz con `packageManager: "pnpm@11"`, `engines: { node: ">=24" }` y scripts de Turborepo
2. Crear `.npmrc` raíz con `save-exact=true` — obligatorio para versiones exactas de paquetes
3. Crear `pnpm-workspace.yaml` listando todos los `apps/*` y `packages/*`
4. Crear `turbo.json` con pipeline para `build`, `dev`, `lint`, `typecheck`, `test`
5. Crear todas las configuraciones base de `packages/tsconfig`:
   - `base.json`: strict mode completo + `"types": ["node"]` + sin `baseUrl`
   - `nextjs.json`: extiende base, configuración específica de Next.js 16
   - `nestjs.json`: extiende base, `"module": "commonjs"`, decorators habilitados
6. Crear `packages/eslint-config` con flat config de TypeScript + Prettier
7. Crear estructura de directorios de todos los packages con `package.json` y `tsconfig.json` mínimos
8. Crear `docker-compose.yml` con servicios: `postgres`, `redis` (sin servicios de app todavía)
9. Crear `docker-compose.test.yml` para tests de integración con contenedores aislados
10. Crear `.env.example` con TODAS las variables del EnvSchema (con valores de ejemplo seguros)
11. Crear `.gitignore` completo: node_modules, dist, .env, .env.local, /tmp, coverage, .turbo
12. Crear `README.md` (visión general del proyecto para usuarios del repo — no este prompt)
13. Crear `LICENSE` con contenido MIT (ver Apéndice F)
14. Crear `SECURITY.md` con política de responsible disclosure (ver Apéndice D)
15. Crear `CONTRIBUTING.md` con guía de contribución (ver Apéndice E)
16. Crear directorio `.github/` con:
    - `PULL_REQUEST_TEMPLATE.md`
    - `workflows/ci.yml` (lint + typecheck + unit tests en cada PR)
    - `workflows/e2e.yml` (playwright E2E en merge a main)
17. Verificar: `pnpm install --frozen-lockfile` completa sin errores
18. Verificar: `pnpm -r typecheck` sin errores de TypeScript

**Entregable:** El agente muestra el árbol de archivos completo y el contenido de cada archivo creado.

---

### FASE 2 — Backend Base (NestJS + Prisma 7 + Auth)

**Objetivo:** API funcionando con autenticación, conexión a base de datos y endpoint de health.

Tareas:

1. Crear el scaffold de `apps/api` como app NestJS con TypeScript estricto
2. Implementar `packages/config` con validación Zod del EnvSchema completo (ver §5) — termina el proceso con código 1 si env es inválido, mostrando qué campo falla
3. Crear `prisma.config.ts` en la raíz del monorepo (url fuera del schema — ver §7)
4. Configurar `apps/api/prisma/schema.prisma` con modelos User y RefreshToken (sin campo url en datasource)
5. Instalar `@prisma/adapter-pg` y `pg` — crear `PrismaService` con el adapter (ver §7)
6. Ejecutar migración inicial: `pnpm --filter @securesupply/api exec prisma migrate dev --name init`
7. Implementar `AuthModule`: register, login, logout, JWT con acceso (1h) + refresh token (7d, cookie httpOnly)
8. Implementar rotación de refresh tokens con detección de reuse attack (ver modelo RefreshToken)
9. Implementar `HealthModule`: endpoints `/health` y `/health/ready` con estado real de DB y Redis
10. Configurar CORS (ver §5 — Configuración de CORS)
11. Configurar Helmet (ver §5 — Configuración de Helmet)
12. Configurar logger Pino con redacción de secretos (ver §5 — Enmascaramiento)
13. Añadir middleware de Request ID: header `x-request-id` generado en cada request
14. Añadir `apps/api` a `docker-compose.yml`
15. Verificar: `docker compose up postgres api` → `GET /health` devuelve `{ status: "ok" }`
16. Verificar: Register → Login → acceder a ruta protegida con JWT funciona end-to-end

---

### FASE 2.5 — Testing Infrastructure

**Objetivo:** Suite de tests completa y robusta antes de continuar con lógica de negocio.

Herramientas:
- **Vitest** para unitarios e integración (más rápido que Jest, nativo ESM)
- **@nestjs/testing** para módulos NestJS
- **Supertest** para tests de HTTP
- **testcontainers** para PostgreSQL/Redis reales en tests de integración
- **@faker-js/faker** para datos de prueba

#### Tests unitarios — `packages/shared`

**RiskScoreService** (función pura, sin mocks):

```
□ Array vacío → { score: 0, level: 'LOW' }
□ Un finding CVE_HIGH (peso 40) → { score: 40, level: 'MEDIUM' }
□ SECRET_FOUND (50) + CVE_HIGH (40) = raw 90, capped a min(90,100)=90 → { score: 90, level: 'CRITICAL' }
□ Dos CVE_CRITICAL (50+50=100) → { score: 100, level: 'CRITICAL' }
□ Tres CVE_CRITICAL (150, capped) → { score: 100, level: 'CRITICAL' }
□ Boundary: score 29 → level 'LOW'
□ Boundary: score 30 → level 'MEDIUM'
□ Boundary: score 49 → level 'MEDIUM'
□ Boundary: score 50 → level 'HIGH'
□ Boundary: score 69 → level 'HIGH'
□ Boundary: score 70 → level 'CRITICAL'
```

**PathValidator**:

```
□ '/tmp/securesupply-scan-abc123/repo' → no lanza error
□ '/tmp/securesupply-scan-abc123' → no lanza error
□ '/tmp/../etc/passwd' → lanza error de path traversal
□ '/home/user/malicious' → lanza error de path traversal
□ '/tmp/securesupply-scan-/../otro' → lanza error (path normalizado es peligroso)
```

**EnvSchema**:

```
□ Objeto válido completo → no lanza error
□ DATABASE_URL sin protocolo → lanza ZodError con mensaje descriptivo
□ JWT_SECRET de menos de 32 caracteres → lanza ZodError
□ GITHUB_APP_PRIVATE_KEY con '-----BEGIN RSA PRIVATE KEY-----' → válido
□ GITHUB_APP_PRIVATE_KEY con '-----BEGIN PRIVATE KEY-----' (PKCS#8) → válido
□ GITHUB_APP_PRIVATE_KEY con texto arbitrario → lanza ZodError con mensaje claro
□ Variable ausente → el mensaje de error indica exactamente qué campo falta
□ WORKER_CONCURRENCY=9 (> max 8) → lanza ZodError
□ SCANNER_TIMEOUT_MS=0 → acepta (es un número válido ≥ 0)
```

#### Tests unitarios — `apps/api`

**AuthService**:

```
□ Registro con email duplicado → lanza ConflictException (sin revelar si el email existe)
□ Login con contraseña incorrecta → lanza UnauthorizedException genérico (mismo mensaje que email inexistente)
□ Login correcto → devuelve accessToken (JWT válido) y refreshToken
□ Refresh con token expirado → lanza UnauthorizedException
□ Refresh con token ya rotado (reuse attack) → revoca TODA la sesión del usuario (todos sus refresh tokens)
□ Logout → token marcado como revocado en BD
```

**WebhookController**:

```
□ Firma HMAC válida + payload push → encola job, devuelve 200
□ Firma HMAC inválida → devuelve 401, NO encola ningún job
□ Payload sin firma → devuelve 401
□ Evento no soportado (issues, star) → devuelve 200 sin encolar job
□ Payload malformado (JSON inválido) → devuelve 400
```

**RepositoryService — lock concurrente**:

```
□ Trigger scan con scan ya RUNNING → lanza ConflictException (409)
□ Trigger scan con scan QUEUED → lanza ConflictException (409)
□ Trigger scan con scan COMPLETED → crea nuevo scan (200)
□ Trigger scan con scan FAILED → crea nuevo scan (200)
```

#### Tests unitarios — `apps/worker`

**FindingNormalizationService**:

```
□ Output real de Trivy con CVE → Finding con severity CRITICAL/HIGH/MEDIUM/LOW mapeado correctamente
□ Output de Gitleaks con secret → Finding con severity HIGH y metadata con tipo de secreto
□ Output de Semgrep con match → Finding con location.file y location.line presentes
□ Scanner con exitCode !== 0 → no lanza excepción, devuelve findings vacío con timedOut=false
□ Scanner con timedOut=true → findings vacío, error registrado en metadata
□ Output JSON malformado de scanner → no lanza excepción, devuelve findings vacío
```

**CloneService — path validation**:

```
□ URL de repo válida de GitHub → clone exitoso
□ URL con protocolo file:// → rechazada antes del clone (SSRF prevention)
□ URL con IP privada → rechazada antes del clone
□ Repo que supera MAX_REPO_SIZE_MB → lanza RepoTooLargeError antes del clone
□ Clone exitoso + error en scanner → directorio /tmp eliminado igualmente (finally)
□ Clone fallido → directorio /tmp eliminado igualmente (finally)
```

#### Tests de integración — `apps/api`

Usando testcontainers (PostgreSQL + Redis reales):

```
□ POST /auth/register → GET /auth/me (con JWT) → datos correctos en BD
□ POST /repositories → POST /repositories/:id/scan → ScanJob en BD con status PENDING
□ POST /repositories/:id/scan dos veces rápido → segunda devuelve 409
□ GET /scans/:id/events → Content-Type: text/event-stream, conexión se mantiene abierta
□ GET /health → { status: "ok", db: "ok", redis: "ok" }
□ Request con JWT expirado → 401
□ Request sin JWT a ruta protegida → 401
□ Petición 101 en 1 minuto → 429 (rate limiting activo)
```

#### Cobertura mínima aceptable

- `packages/shared`: **90%** (funciones puras críticas de seguridad)
- `apps/api/src`: **80%**
- `apps/worker/src`: **80%**

Comandos:

```bash
pnpm test                    # Todos los tests
pnpm test --coverage         # Con reporte de cobertura
pnpm --filter @securesupply/api test:integration  # Solo integración
```

---

### FASE 3 — Integración GitHub App

**Objetivo:** Recibir y validar webhooks de GitHub, gestionar conexiones de repositorios.

Tareas:

1. Implementar `GitHubModule` usando `@octokit/rest` y `@octokit/webhooks`
2. Implementar `POST /webhooks/github` con verificación de firma HMAC (401 si inválida)
3. Implementar `RepositoryModule` (CRUD) con autorización (solo repos del usuario autenticado)
4. Añadir modelos Prisma restantes: `ScanJob`, `ScanResult`, `Finding` — migración: `prisma migrate dev --name scan-models`
5. Implementar lock de scan concurrente (ver §5 — Lock de Scan Concurrente)
6. Validar URLs de repo de GitHub antes de cualquier operación (evitar SSRF: rechazar `file://`, `ssh://`, IPs privadas)
7. Verificar: Test de webhook desde configuración de GitHub App devuelve HTTP 200
8. Verificar: Enviar webhook con secret incorrecto devuelve 401

---

### FASE 4 — Worker & Cola de Jobs

**Objetivo:** Worker BullMQ recibiendo y procesando jobs (sin scanners todavía — solo logging y estado).

Tareas:

1. Crear scaffold de `apps/worker` como app NestJS standalone
2. Implementar `ScanQueue` en `apps/api` — encolar job en webhook o trigger manual
3. Implementar `ScanWorker` en `apps/worker` — procesar jobs de `scan-queue`
4. Leer `WORKER_CONCURRENCY` del EnvSchema para configurar la concurrencia de BullMQ:
   ```typescript
   const worker = new Worker('scan-queue', processor, {
     connection: redisConnection,
     concurrency: env.WORKER_CONCURRENCY, // configurable, default 2
   });
   ```
5. Implementar máquina de estados del job: PENDING → QUEUED → RUNNING → COMPLETED/FAILED
6. Actualizar estado en Redis a cada transición (para que SSE lo lea con baja latencia)
7. Implementar lógica de reintentos: 3 intentos, backoff exponencial (1s, 4s, 16s)
8. Añadir `apps/worker` a `docker-compose.yml`
9. Verificar: Disparar escaneo manual vía API, confirmar que el job transiciona por todos los estados en BD y Redis

---

### FASE 5 — Integración de Scanners

**Objetivo:** Pipeline de escaneo completo con los cuatro scanners, produciendo findings y risk scores.

Tareas:

1. Implementar `CloneService`:
   - Verificar tamaño del repo vía GitHub API antes de clonar
   - Clonar con `simple-git` en `/tmp/securesupply-scan-{uuid}/`
   - Siempre usar bloque `finally` para limpieza
2. Implementar validador de paths (`validarRutaSegura`) en `packages/shared` — aplicarlo en cada scanner
3. Implementar `TrivyScanner` con timeout configurable
4. Implementar `OsvScanner` con timeout configurable
5. Implementar `SemgrepScanner` con timeout configurable
6. Implementar `GitleaksScanner` con timeout configurable
7. Leer `SCANNER_TIMEOUT_MS` del EnvSchema y pasarlo a cada scanner
8. Implementar `RiskScoreService` en `packages/shared` usando tabla de pesos del §6
9. Implementar `FindingNormalizationService` — mapea todas las salidas de scanners al tipo `NormalizedFinding`
10. Actualizar estado en Redis a cada paso del pipeline (para SSE)
11. Persistir `ScanResult` y `Finding[]` en PostgreSQL al finalizar
12. Añadir `trivy`, `osv-scanner`, `semgrep`, `gitleaks` al Dockerfile del worker (ver Apéndice C)
13. Verificar: Escaneo completo de repo público de prueba (`lodash/lodash`) produce findings en BD
14. Verificar: `/tmp` no tiene directorios `securesupply-scan-*` tras finalizar el scan

---

### FASE 6 — SSE Endpoint + Dashboard Web

**Objetivo:** Endpoint SSE funcional + Dashboard Next.js completo con diseño profesional.

#### Parte A — SSE Endpoint (apps/api)

Tareas:

1. Implementar `GET /api/v1/scans/:id/events` con SSE:
   - Verificar autorización: el scan debe pertenecer al usuario autenticado
   - Leer estado desde Redis (`scan:{id}:status` y `scan:{id}:progress`)
   - Emitir evento inicial con estado actual
   - Subscribirse a canal Redis Pub/Sub `scan:{id}:updates` para recibir cambios
   - Cerrar la conexión SSE al recibir evento `complete` o `error`
   - Manejar desconexión del cliente (limpiar subscripción Redis)
2. Verificar: `curl -N http://localhost:4000/api/v1/scans/{id}/events` muestra eventos SSE en tiempo real

#### Parte B — Dashboard Web (apps/web)

Páginas:

- `/` — Resumen del dashboard (total repos, scans recientes, distribución de riesgo agregada)
- `/repositories` — Lista de repositorios conectados con estado del último scan
- `/repositories/[id]` — Detalle del repositorio + historial de scans
- `/repositories/[id]/scan/[scanId]` — Detalle del scan: gauge de risk score, tabla de findings, indicador SSE
- `/auth/login` — Página de login
- `/auth/register` — Página de registro

Requisitos funcionales:

- React Query para obtención de datos estáticos (listas, detalles de repos completados)
- **SSE con EventSource** para el estado de scans activos — NO React Query con refetchInterval
- Risk score mostrado como gauge radial animado (Recharts)
- Tabla de findings con filtro por severidad y por scanner
- shadcn/ui para componentes UI (con personalización obligatoria de tema)
- Completamente responsive (móvil + escritorio)

Requisitos de diseño (ver [HARD RULE] Diseño Visual):

- Paleta dark mode con acentos de seguridad (cian/verde para OK, rojo para crítico)
- Tipografía monospace para datos técnicos (CVE IDs, hashes, rutas de archivo)
- Gauge animado con gradiente de color según nivel de riesgo
- Badges de severidad con color sólido y contraste alto
- Indicador de progreso SSE visual: muestra paso actual y porcentaje
- La interfaz debe transmitir identidad de herramienta de seguridad profesional

---

### FASE 7 — Hardening & Operacionalización

**Objetivo:** Logging robusto listo para producción, security headers, rate limiting, CORS, límites operacionales.

Tareas:

1. Verificar que `helmet` está activo con la configuración del §5 (CSP + HSTS)
2. Verificar que CORS está configurado correctamente (origin desde env, no `'*'`)
3. Añadir `@nestjs/throttler` con configuración de dos niveles:
   - Global: 100 req/min por IP
   - Endpoints de auth (`/auth/login`, `/auth/register`, `/auth/refresh`): 10 req/min por IP
4. Añadir filtro de excepciones global — formato de respuesta de error consistente:
   ```json
   { "statusCode": 4xx, "message": "...", "requestId": "uuid", "timestamp": "ISO8601" }
   ```
   Sin stack traces en producción (`NODE_ENV === 'production'`)
5. Verificar que el middleware de Request ID (`x-request-id`) está propagado en todos los logs
6. Verificar que `pino-http` logea cada request con: duración, status, método, path, requestId
7. Implementar health check estructurado con tiempos de respuesta reales:
   - Tiempo de conexión a BD (query `SELECT 1`)
   - Ping a Redis (`PING`)
   - Profundidad de cola del worker (jobs en BullMQ waiting + active)
8. Añadir `healthcheck` a `docker-compose.yml` para todos los servicios
9. Verificar que no hay secretos en logs: grep del log por un token de prueba conocido → no encontrado
10. Verificar: test de carga con 50 peticiones concurrentes no hace caer ningún servicio
11. Verificar: la petición 101 en 1 minuto devuelve 429 con header `Retry-After`

---

### FASE 8 — CI/CD con GitHub Actions

**Objetivo:** Pipeline de integración y despliegue continuo completo y seguro.

#### `.github/workflows/ci.yml` — se ejecuta en cada PR

```yaml
name: CI

on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [main]

env:
  PNPM_VERSION: '11'
  NODE_VERSION: '24'

jobs:
  lint-typecheck:
    name: Lint + Typecheck
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: '${{ env.PNPM_VERSION }}' }
      - uses: actions/setup-node@v4
        with:
          node-version: '${{ env.NODE_VERSION }}'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm -r lint
      - run: pnpm -r typecheck

  unit-tests:
    name: Unit & Integration Tests
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:17-alpine
        env:
          POSTGRES_USER: securesupply
          POSTGRES_PASSWORD: test_password_ci
          POSTGRES_DB: securesupply_test
        ports: ['5432:5432']
        options: --health-cmd pg_isready --health-interval 10s
      redis:
        image: redis:8-alpine
        ports: ['6379:6379']
        options: --health-cmd "redis-cli ping" --health-interval 10s
    env:
      DATABASE_URL: postgresql://securesupply:test_password_ci@localhost:5432/securesupply_test
      REDIS_URL: redis://localhost:6379
      JWT_SECRET: test_jwt_secret_min_32_chars_required_abc
      REFRESH_TOKEN_SECRET: test_refresh_secret_min_32_chars_xyz
      GITHUB_APP_ID: '123456'
      GITHUB_APP_PRIVATE_KEY: ${{ secrets.TEST_GITHUB_APP_PRIVATE_KEY }}
      GITHUB_WEBHOOK_SECRET: test_webhook_secret_min_20
      NODE_ENV: test
      FRONTEND_URL: http://localhost:3000
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: '${{ env.PNPM_VERSION }}' }
      - uses: actions/setup-node@v4
        with:
          node-version: '${{ env.NODE_VERSION }}'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @securesupply/api exec prisma migrate deploy
      - run: pnpm test --coverage
      - name: Subir reporte de cobertura
        uses: codecov/codecov-action@v4
        if: always()

  build-check:
    name: Build Verification
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: '${{ env.PNPM_VERSION }}' }
      - uses: actions/setup-node@v4
        with:
          node-version: '${{ env.NODE_VERSION }}'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm -r build
```

#### `.github/workflows/e2e.yml` — se ejecuta en merge a main

```yaml
name: E2E Tests

on:
  push:
    branches: [main]

jobs:
  e2e:
    name: Playwright E2E
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: '11' }
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec playwright install --with-deps chromium
      - name: Iniciar infraestructura de test
        run: docker compose -f docker-compose.test.yml up -d
      - name: Esperar a que los servicios estén listos
        run: |
          timeout 60 bash -c 'until curl -s http://localhost:4000/api/v1/health/ready; do sleep 2; done'
      - run: pnpm --filter @securesupply/web test:e2e
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: apps/web/playwright-report/
```

---

### FASE 9 — Tests E2E con Playwright

**Objetivo:** Suite completa de tests end-to-end del dashboard.

Tests obligatorios:

```
□ Flujo de registro: rellenar formulario → registrar → redirigir al dashboard
□ Flujo de login: credenciales correctas → JWT en cookie → acceso al dashboard
□ Flujo de login fallido: credenciales incorrectas → mensaje de error sin revelar si el email existe
□ Logout: botón de logout → cookie JWT eliminada → redirigir a /auth/login
□ Sesión expirada: JWT expirado → redirigir automáticamente a /auth/login
□ Conectar repositorio: rellenar "owner/repo" → aparece en la lista de repos
□ Disparar scan manual: botón "Scan ahora" → indicador SSE aparece → progreso actualiza en tiempo real
□ Scan completado: gauge de risk score visible y animado, tabla de findings con datos
□ Filtro de findings: filtrar por severidad CRITICAL → solo se muestran los críticos
□ Scan en repo inexistente → mensaje de error claro en la UI
□ Navegación responsive: menú funciona en viewport de 375px (móvil)
□ Acceso a ruta protegida sin login → redirige a /auth/login
```

Configuración en `apps/web/playwright.config.ts`:

```typescript
// Configuración de Playwright para E2E del dashboard
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: process.env['CI'] ? 2 : 0,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: 'pnpm --filter @securesupply/api start:test',
      port: 4000,
      reuseExistingServer: !process.env['CI'],
    },
    {
      command: 'pnpm --filter @securesupply/web dev',
      port: 3000,
      reuseExistingServer: !process.env['CI'],
    },
  ],
});
```

---

## 10. Acceptance Criteria per Phase

El agente debe auto-verificar cada criterio antes de marcar una fase como completada.

| Fase | Criterio | Método de Verificación |
|------|----------|------------------------|
| 1 | `pnpm install` tiene éxito | `pnpm install --frozen-lockfile` |
| 1 | `pnpm -r build` tiene éxito | `pnpm -r build` |
| 1 | TypeScript strict sin errores | `pnpm -r typecheck` |
| 1 | `.npmrc` con save-exact=true | `cat .npmrc \| grep save-exact` |
| 1 | LICENSE, SECURITY.md, CONTRIBUTING.md existen | `ls LICENSE SECURITY.md CONTRIBUTING.md` |
| 1 | CI workflow sintácticamente válido | `cat .github/workflows/ci.yml` |
| 2 | `GET /health` devuelve 200 | `curl http://localhost:4000/api/v1/health` |
| 2 | Migración Prisma aplicada | `psql` muestra tablas `User`, `RefreshToken`, `Repository` |
| 2 | Auth JWT funciona end-to-end | Register → Login → ruta protegida → 200 |
| 2 | CORS correcto | `curl -H "Origin: http://localhost:3000"` → header `Access-Control-Allow-Origin` presente |
| 2 | CORS rechaza origins no autorizados | `curl -H "Origin: http://evil.com"` → sin header CORS |
| 2 | Security headers activos | `curl -I` muestra `x-content-type-options`, `x-frame-options`, `content-security-policy` |
| 2.5 | Cobertura ≥ 90% en packages/shared | `pnpm test --coverage` |
| 2.5 | Cobertura ≥ 80% en apps/api | `pnpm test --coverage` |
| 2.5 | Tests de boundary del Risk Score pasan | `pnpm test risk-score` |
| 2.5 | Tests de path validation pasan | `pnpm test path-validator` |
| 3 | Webhook con secret incorrecto → 401 | Enviar request con secret incorrecto |
| 3 | CRUD de repositorios funciona | Crear, listar, obtener, borrar repo vía API |
| 3 | Lock concurrente activo | Disparar scan dos veces → segunda devuelve 409 |
| 4 | Transiciones de estado del job | Verificar en BD: PENDING→QUEUED→RUNNING→COMPLETED |
| 4 | Estado en Redis actualizado | `redis-cli GET scan:{id}:status` muestra transiciones |
| 4 | Reintento en caso de fallo | Forzar fallo, verificar que `retryCount` aumenta |
| 5 | Scan produce findings | `GET /scans/:id/findings` devuelve array no vacío |
| 5 | Limpieza de directorio temporal | `ls /tmp \| grep securesupply` → vacío tras scan |
| 5 | Risk score calculado | `ScanResult.riskScore` es número entre 0–100 |
| 5 | Timeout de scanner activo | Verificar que `SCANNER_TIMEOUT_MS` se aplica |
| 6 | SSE endpoint responde | `curl -N /api/v1/scans/:id/events` → text/event-stream |
| 6 | Dashboard carga | `http://localhost:3000` sin errores de consola |
| 6 | Actualizaciones SSE en tiempo real | Badge de estado actualiza sin recargar la página |
| 6 | Diseño no genérico | UI dark, tipografía monospace, gauge animado |
| 7 | Rate limiting activo | Petición 101/min devuelve 429 con `Retry-After` |
| 7 | Sin secretos en logs | `grep token /var/log/api.log` → solo `[REDACTADO]` |
| 7 | Health check completo | `/health` devuelve tiempos de DB, Redis y profundidad de cola |
| 8 | CI pasa en PR de prueba | Push a rama de prueba → GitHub Actions verde |
| 8 | Tests de CI incluyen integración | Verificar que CI levanta postgres y redis reales |
| 9 | E2E: flujo completo de scan funciona | Playwright: registro → login → scan → findings |
| 9 | E2E: SSE actualiza UI | Playwright: indicador de progreso cambia durante el scan |

---

## 11. Agent Communication Protocol

El agente DEBE seguir este patrón de comunicación con precisión. **TODA la comunicación es en ESPAÑOL.**

### Al iniciar una fase

```
=== INICIANDO FASE {N}: {NOMBRE} ===
Leyendo requisitos de §9...
Acciones planificadas:
  1. {acción}
  2. {acción}
  ...
```

### Después de crear cada archivo

```
✅ Creado: {filepath}
   Propósito: {descripción en una línea en español}
```

### Completación de fase

```
=== FASE {N} COMPLETADA ===
Archivos creados: {cantidad}
Criterios de aceptación:
  ✅ {criterio 1}
  ✅ {criterio 2}
  ...

⏸ ESPERANDO CONFIRMACIÓN PARA INICIAR FASE {N+1}
```

### Si se fuera a violar una hard rule

```
⛔ VIOLACIÓN DE HARD RULE PREVENIDA
Regla: {nombre de la regla}
Acción solicitada: {qué se pedía}
Resolución: {cómo procederá el agente en su lugar}
```

### Si hay dudas o ambigüedad

```
❓ ACLARACIÓN NECESARIA
Contexto: {descripción del punto ambiguo}
Opciones posibles:
  A) {opción A}
  B) {opción B}
¿Cuál debo usar?
```

---

## 12. Anti-Patterns — Lo que NUNCA hay que hacer

| Anti-Pattern | Por qué está prohibido | Alternativa correcta |
|---|---|---|
| `exec(\`git clone ${url}\`)` | Riesgo de inyección de shell | `execFile('git', ['clone', url, dir])` |
| `npm install` en repo clonado | Ejecuta scripts postinstall | Solo análisis estático de archivos |
| `process.env.SECRET` sin validación | Undefined en runtime → crash | Esquema Zod de env en `packages/config` |
| Tipo `any` en TypeScript | Anula la seguridad de tipos | Tipos explícitos o `unknown` + type narrowing |
| Capturar todos los errores y silenciarlos | Oculta bugs silenciosamente | Re-throw o log + respuesta de error estructurada |
| Almacenar tokens de GitHub en BD | Riesgo de exposición de token | Generar tokens de instalación frescos por petición |
| `console.log` para logging | No estructurado, difícil de parsear | Logger Pino con salida JSON estructurada |
| `^1.2.3` en package.json | Instalaciones no deterministas | Solo versiones exactas: `1.2.3` |
| Hacer commit de archivos `.env` | Exposición de credenciales | Solo `.env.example`, `.env` en `.gitignore` |
| `refetchInterval` en React Query para scans activos | Polling innecesario, anti-patrón del §2 | SSE con EventSource — `GET /scans/:id/events` |
| `setInterval`/`setTimeout` para polling de estado | Gasto de recursos, viola HARD RULE SSE | SSE con Redis Pub/Sub |
| CORS con `origin: '*'` | Permite cualquier origen — fallo de seguridad | `origin: env.FRONTEND_URL` (valor específico) |
| Queries SQL crudas | Riesgo de inyección SQL | Solo Prisma ORM |
| Rutas glob como input de scanner | Riesgo de path traversal | `validarRutaSegura()` antes de cada operación |
| `url = env("DATABASE_URL")` en schema.prisma | No válido en Prisma 7 | Configurar en `prisma.config.ts` |
| `new PrismaClient()` sin adapter | Incompatible con Prisma 7 | `new PrismaClient({ adapter: new PrismaPg(pool) })` |
| Comentarios en inglés en el código | Incumple [HARD RULE] de idioma | Todos los comentarios en español |
| shadcn/ui sin personalización de tema | Diseño genérico, incumple [HARD RULE] | Personalizar paleta, tipografía y design tokens |
| Clonar sin verificar tamaño del repo | Puede agotar disco del servidor | Verificar vía GitHub API antes del clone |
| Dos scans simultáneos del mismo repo | Gasta recursos, resultados confusos | Lock concurrente → 409 si ya hay scan activo |
| Imagen Docker con root user | Riesgo de escalada de privilegios | Usuario no-root con UID 1001 (ver Apéndice C) |
| `npm` en cualquier comando | Viola [HARD RULE] de package manager | Siempre `pnpm` — nunca `npm` ni `yarn` |

---

## Apéndice A — Comandos de Setup Local

```bash
# Prerrequisitos (deben estar instalados en la máquina host)
# - Docker Desktop o Docker Engine + Compose v2
# - Node.js 24 LTS
# - pnpm 11.x  →  npm install -g pnpm@11  (única vez que se permite npm)
# - Para pruebas locales de scanners: trivy, osv-scanner, semgrep, gitleaks

# Clonar y configurar
git clone https://github.com/TU_USUARIO/securesupply.git
cd securesupply

# Instalar todas las dependencias
pnpm install --frozen-lockfile

# Copiar y rellenar las variables de entorno
cp .env.example .env
# Editar .env con las credenciales de tu GitHub App y secretos

# Iniciar infraestructura (postgres + redis)
docker compose up postgres redis -d

# Ejecutar migraciones de base de datos
pnpm --filter @securesupply/api exec prisma migrate dev

# Iniciar todos los servicios en modo desarrollo
pnpm dev

# Servicios disponibles en:
# - Web Dashboard:  http://localhost:3000
# - API:            http://localhost:4000/api/v1
# - API Docs:       http://localhost:4000/api/docs
# - Worker:         http://localhost:4001 (solo health)

# Ejecutar tests
pnpm test
pnpm test --coverage

# Ejecutar tests E2E (requiere servicios en ejecución)
pnpm --filter @securesupply/web test:e2e
```

---

## Apéndice B — Configuración de la GitHub App

1. Ir a `https://github.com/settings/apps/new`
2. Establecer **Webhook URL** al endpoint de la API (usar `ngrok` para dev local): `https://xxx.ngrok.io/api/v1/webhooks/github`
3. Establecer **Webhook Secret** — copiar a `GITHUB_WEBHOOK_SECRET` en `.env`
4. Permisos requeridos:
   - Repository: `Contents` → Solo lectura
   - Repository: `Metadata` → Solo lectura
   - Repository: `Webhooks` → Solo lectura
5. Suscribirse a eventos: `Push`, `Pull request`
6. Descargar la **Private Key** (.pem) y pegar el contenido en `GITHUB_APP_PRIVATE_KEY` en `.env`
7. Anotar el **App ID** y copiarlo a `GITHUB_APP_ID` en `.env`
8. Instalar la App en tus repositorios

> **Multi-usuario:** Cada usuario de SecureSupply debe crear su propia GitHub App y configurar
> sus credenciales en el `.env` de su instancia self-hosted. SecureSupply no comparte credenciales
> entre usuarios.

---

## Apéndice C — Especificaciones de Dockerfiles

### `infrastructure/docker/api.Dockerfile`

```dockerfile
# Fase de dependencias — solo instala pnpm y deps de producción
FROM node:24-alpine AS deps
WORKDIR /app

# Instalar pnpm — única llamada a npm permitida en todo el proyecto
RUN npm install -g pnpm@11 --prefer-offline
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml .npmrc ./
COPY packages/ ./packages/
COPY apps/api/package.json ./apps/api/

# Instalar solo dependencias de producción
RUN pnpm install --frozen-lockfile --filter @securesupply/api...

# Fase de build — compila TypeScript
FROM node:24-alpine AS builder
WORKDIR /app

RUN npm install -g pnpm@11 --prefer-offline
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY . .

# Generar cliente Prisma y compilar
RUN pnpm --filter @securesupply/api exec prisma generate
RUN pnpm --filter @securesupply/api build

# Fase de producción — imagen mínima y segura
FROM node:24-alpine AS runner
WORKDIR /app

# Crear usuario no-root con UID/GID fijos para reproducibilidad
RUN addgroup -g 1001 -S securesupply && \
    adduser -u 1001 -S securesupply -G securesupply

# Copiar solo lo necesario para producción
COPY --from=builder --chown=securesupply:securesupply /app/apps/api/dist ./dist
COPY --from=builder --chown=securesupply:securesupply /app/node_modules ./node_modules
COPY --from=builder --chown=securesupply:securesupply /app/apps/api/prisma ./prisma

# Cambiar al usuario no-root
USER securesupply

EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget -qO- http://localhost:4000/api/v1/health/ready || exit 1

CMD ["node", "dist/main.js"]
```

### `infrastructure/docker/worker.Dockerfile`

```dockerfile
# Fase de dependencias
FROM node:24-alpine AS deps
WORKDIR /app

RUN npm install -g pnpm@11 --prefer-offline
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml .npmrc ./
COPY packages/ ./packages/
COPY apps/worker/package.json ./apps/worker/
RUN pnpm install --frozen-lockfile --filter @securesupply/worker...

# Fase de build
FROM node:24-alpine AS builder
WORKDIR /app

RUN npm install -g pnpm@11 --prefer-offline
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY . .
RUN pnpm --filter @securesupply/worker build

# Fase de producción — incluye los binarios de los scanners
FROM node:24-alpine AS runner
WORKDIR /app

# Instalar dependencias del sistema y los cuatro scanners de seguridad
RUN apk add --no-cache \
    curl \
    git \
    python3 \
    # Trivy
    && curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh \
       | sh -s -- -b /usr/local/bin \
    # osv-scanner
    && curl -fsSL https://github.com/google/osv-scanner/releases/latest/download/osv-scanner_linux_amd64 \
       -o /usr/local/bin/osv-scanner && chmod +x /usr/local/bin/osv-scanner \
    # semgrep
    && pip3 install semgrep --break-system-packages \
    # gitleaks
    && curl -fsSL https://github.com/gitleaks/gitleaks/releases/latest/download/gitleaks_linux_amd64.tar.gz \
       | tar -xz -C /usr/local/bin gitleaks

# Crear usuario no-root
RUN addgroup -g 1001 -S securesupply && \
    adduser -u 1001 -S securesupply -G securesupply

COPY --from=builder --chown=securesupply:securesupply /app/apps/worker/dist ./dist
COPY --from=builder --chown=securesupply:securesupply /app/node_modules ./node_modules

# El directorio /tmp necesita ser escribible por el usuario del worker
RUN mkdir -p /tmp && chmod 1777 /tmp

USER securesupply

EXPOSE 4001
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget -qO- http://localhost:4001/health || exit 1

CMD ["node", "dist/main.js"]
```

### `infrastructure/docker/web.Dockerfile`

```dockerfile
# Fase de dependencias
FROM node:24-alpine AS deps
WORKDIR /app

RUN npm install -g pnpm@11 --prefer-offline
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml .npmrc ./
COPY packages/ ./packages/
COPY apps/web/package.json ./apps/web/
RUN pnpm install --frozen-lockfile --filter @securesupply/web...

# Fase de build — Next.js con output standalone
FROM node:24-alpine AS builder
WORKDIR /app

RUN npm install -g pnpm@11 --prefer-offline
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @securesupply/web build

# Fase de producción — imagen mínima usando standalone output
FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Crear usuario no-root
RUN addgroup -g 1001 -S securesupply && \
    adduser -u 1001 -S securesupply -G securesupply

# Copiar el output standalone de Next.js
COPY --from=builder --chown=securesupply:securesupply /app/apps/web/.next/standalone ./
COPY --from=builder --chown=securesupply:securesupply /app/apps/web/.next/static ./.next/static
COPY --from=builder --chown=securesupply:securesupply /app/apps/web/public ./public

USER securesupply

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
```

> **Requisito en `apps/web/next.config.ts`:**
> ```typescript
> const nextConfig = { output: 'standalone' };
> export default nextConfig;
> ```

---

## Apéndice D — Contenido de SECURITY.md

```markdown
# Security Policy

## Versiones soportadas

| Versión | Soporte de seguridad |
|---------|----------------------|
| main    | ✅ Activo            |
| < main  | ❌ Sin soporte       |

SecureSupply es un proyecto self-hosted sin releases versionados formales en su etapa MVP.
Los parches de seguridad se aplican directamente en la rama `main`.

## Cómo reportar una vulnerabilidad

**Por favor, NO abras un Issue público para reportar vulnerabilidades de seguridad.**
Los issues públicos pueden exponer la vulnerabilidad antes de que esté parcheada.

### Método preferido — GitHub Private Security Advisory

Usa la función de **reporte privado de vulnerabilidades** de GitHub:

1. Ve a la pestaña **Security** de este repositorio
2. Haz clic en **"Report a vulnerability"** (requiere estar autenticado en GitHub)
3. Rellena el formulario con todos los detalles

GitHub notificará automáticamente al mantenedor del repositorio a través del **correo
electrónico vinculado a su cuenta de GitHub**. Toda la comunicación se mantiene privada
hasta que se publique el advisory.

### Información a incluir en el reporte

Para acelerar la resolución, incluye:

- **Descripción**: descripción clara de la vulnerabilidad
- **Componente afectado**: `apps/api`, `apps/worker`, `apps/web`, o `packages/*`
- **Pasos para reproducir**: instrucciones paso a paso
- **Impacto**: qué puede hacer un atacante con esta vulnerabilidad
- **Evidencia**: capturas de pantalla, logs, o PoC (sin incluir datos reales de usuarios)
- **Severidad estimada**: Critical / High / Medium / Low

### Compromisos del mantenedor

| Acción | Plazo |
|--------|-------|
| Confirmación de recepción | 48 horas |
| Evaluación de severidad | 5 días hábiles |
| Parche para vulnerabilidades Critical/High | 14 días |
| Parche para vulnerabilidades Medium/Low | 30 días |
| Publicación del advisory | Tras el parche |

### Scope — qué está en scope

- Ejecución remota de código (RCE)
- Inyección SQL / NoSQL
- Bypasses de autenticación o autorización
- Exposición de secretos o tokens
- Path traversal / directory traversal
- SSRF (Server-Side Request Forgery)
- Cross-Site Scripting (XSS)
- CSRF con impacto real
- Configuraciones inseguras por defecto

### Out of scope

- Vulnerabilidades en dependencias externas (reportarlas directamente a sus mantenedores)
- Problemas teóricos sin PoC funcional
- Ataques que requieren acceso físico a la máquina
- Self-XSS (que solo afecta al propio usuario)

## Reconocimientos

Los investigadores que reporten vulnerabilidades válidas serán reconocidos en este archivo
(con su permiso) una vez que la vulnerabilidad haya sido parcheada.

---

*Este documento sigue las mejores prácticas de [GitHub Security Advisories](https://docs.github.com/en/code-security/security-advisories).*
```

---

## Apéndice E — Contenido de CONTRIBUTING.md

```markdown
# Guía de Contribución a SecureSupply

¡Gracias por tu interés en contribuir a SecureSupply! Este documento explica cómo
participar de forma efectiva en el proyecto.

## Código de Conducta

Este proyecto se rige por el [Contributor Covenant](https://www.contributor-covenant.org/).
Al participar, te comprometes a mantener un entorno respetuoso e inclusivo.

## ¿Cómo puedo contribuir?

### Reportar bugs

1. Busca primero en los [Issues existentes](../../issues) para evitar duplicados
2. Si no existe, abre un nuevo Issue usando la plantilla **Bug Report**
3. Incluye: pasos para reproducir, comportamiento esperado, comportamiento actual, versión de Node.js y OS
4. **Para vulnerabilidades de seguridad**: consulta primero [SECURITY.md](./SECURITY.md)

### Proponer mejoras

1. Abre un Issue con la plantilla **Feature Request** antes de implementar
2. Describe el problema que resuelves, no solo la solución
3. Espera confirmación del mantenedor antes de empezar a codificar

### Enviar Pull Requests

#### Prerrequisitos

- Node.js 24 LTS
- pnpm 11.x (`npm install -g pnpm@11`)
- Docker + Docker Compose v2
- Para tests locales de scanners: `trivy`, `osv-scanner`, `semgrep`, `gitleaks`

#### Setup del entorno de desarrollo

```bash
git clone https://github.com/TU_USUARIO/securesupply.git
cd securesupply
pnpm install --frozen-lockfile
cp .env.example .env
# Editar .env con tus credenciales de test
docker compose up postgres redis -d
pnpm --filter @securesupply/api exec prisma migrate dev
pnpm dev
```

#### Proceso de contribución

1. **Fork** el repositorio
2. Crea una rama desde `main`: `git checkout -b feat/nombre-descriptivo`
3. Haz tus cambios siguiendo las convenciones del proyecto
4. Añade o actualiza los tests correspondientes
5. Asegúrate de que pasan todos los checks: `pnpm -r lint && pnpm -r typecheck && pnpm test`
6. Haz commit usando **Conventional Commits**
7. Abre un Pull Request hacia `main`

#### Convenciones de Commits (Conventional Commits)

Todos los commits deben seguir el formato:

```
<tipo>(<scope>): <descripción en español>

[cuerpo opcional]
[footer opcional]
```

**Tipos válidos:**

| Tipo | Cuándo usarlo |
|------|---------------|
| `feat` | Nueva funcionalidad |
| `fix` | Corrección de bug |
| `security` | Parche de seguridad (prioritario) |
| `test` | Añadir o corregir tests |
| `docs` | Solo documentación |
| `refactor` | Refactorización sin cambio de comportamiento |
| `chore` | Tareas de mantenimiento (deps, config) |
| `ci` | Cambios en CI/CD |

**Ejemplos:**

```
feat(api): añadir endpoint SSE para actualizaciones de scan en tiempo real
fix(worker): corregir limpieza de directorio temporal cuando gitleaks falla
security(api): aumentar longitud mínima de JWT_SECRET a 64 caracteres
test(shared): añadir tests de boundary para el cálculo de Risk Score
```

#### Convenciones de código

- **TypeScript strict** en todos los archivos — `any` está prohibido
- **Comentarios en español** — sin excepción (ver Hard Rules del proyecto)
- **pnpm siempre** — nunca `npm` ni `yarn`
- **Versiones exactas** de paquetes — sin `^` ni `~`
- **Zod para todos los inputs** — ningún valor externo sin validar

#### Checklist del Pull Request

Antes de enviar tu PR, confirma que:

- [ ] Los tests pasan: `pnpm test`
- [ ] Cobertura no ha disminuido: `pnpm test --coverage`
- [ ] Sin errores de TypeScript: `pnpm -r typecheck`
- [ ] Sin errores de linting: `pnpm -r lint`
- [ ] Los comentarios del código están en español
- [ ] No hay secretos, tokens ni credenciales en el código
- [ ] El `.env` no está incluido en el commit
- [ ] Los nuevos endpoints están documentados en el Swagger

## Arquitectura del proyecto

Antes de contribuir, familiarízate con la arquitectura leyendo:

- §3 del `SECURESUPPLY_AGENT_PROMPT.md` — visión general del sistema
- §5 — modelo de seguridad
- §6 — pipeline de scanners

## Preguntas

Si tienes dudas, abre un [Discussion](../../discussions) en el repositorio.
```

---

## Apéndice F — Contenido de LICENSE

```
MIT License

Copyright (c) 2026 SecureSupply Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## Prompt de inicio para OpenCode + gentle-ai

Cuando estés listo para iniciar el proyecto, pega exactamente esto al agente orquestador de gentle-ai:

```
Lee el archivo SECURESUPPLY_AGENT_PROMPT_v2.md en su totalidad antes de hacer cualquier otra cosa.

Este documento es tu contrato de ejecución. Contiene todas las reglas, especificaciones y criterios de aceptación.

Una vez leído, inicia la FASE 1 siguiendo el protocolo de comunicación del §11.

Recuerda:
- Toda comunicación contigo es en ESPAÑOL
- Todos los comentarios del código en ESPAÑOL
- SIEMPRE pnpm — NUNCA npm ni yarn
- TypeScript strict en todo el código
- No iniciar la siguiente fase sin confirmación explícita del usuario

=== COMIENZA LA FASE 1 ===
```

---

*Versión del documento: 2.0.0 — SecureSupply MVP*
*Agente: OpenCode con ecosistema Gentleman Programming (gentle-ai)*
*Última actualización: Mayo 2026*
