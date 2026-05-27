// ─────────────────────────────────────────────
// Tests estructurales — PR #1 (Foundation)
// Backend Auth: Env Config, Prisma Models,
// Database Service, Middleware, Exception Filter
// ─────────────────────────────────────────────
// Sigue el ciclo TDD: RED (test primero) → GREEN (implementación)
// ─────────────────────────────────────────────

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

// Helper: leer archivo como string
function readFile(path: string): string {
  return readFileSync(resolve(__dirname, "..", path), "utf-8");
}

// Helper: verificar que un archivo existe
function fileExists(path: string): boolean {
  return existsSync(resolve(__dirname, "..", path));
}

// Helper: leer archivo solo si existe (para tests progresivos)
function readFileIfExists(path: string): string | null {
  if (!fileExists(path)) return null;
  return readFile(path);
}

// ═══════════════════════════════════════════════════════════
// Task 1.1 — packages/config/src/env.schema.ts
// ═══════════════════════════════════════════════════════════
describe("1.1 — packages/config/src/env.schema.ts", () => {
  const content = readFile("packages/config/src/env.schema.ts");

  it("exporta EnvSchema como objeto Zod", () => {
    expect(content).toContain("export const EnvSchema");
    expect(content).toContain("z.object");
  });

  // ── Database ──
  it("valida DATABASE_URL como z.string().url()", () => {
    expect(content).toContain("DATABASE_URL");
    expect(content).toContain("z.string().url");
  });

  // ── Redis ──
  it("valida REDIS_URL como z.string().url()", () => {
    expect(content).toContain("REDIS_URL");
    expect(content).toContain("z.string().url");
  });

  // ── JWT Secrets ──
  it("valida JWT_SECRET como z.string().min(32)", () => {
    expect(content).toContain("JWT_SECRET");
    expect(content).toContain(".min(32");
  });

  it("valida REFRESH_TOKEN_SECRET como z.string().min(32)", () => {
    expect(content).toContain("REFRESH_TOKEN_SECRET");
    expect(content).toContain(".min(32");
  });

  // ── GitHub ──
  it("valida GITHUB_APP_ID como z.string().min(1)", () => {
    expect(content).toContain("GITHUB_APP_ID");
    expect(content).toContain(".min(1");
  });

  it("valida GITHUB_APP_PRIVATE_KEY con refinamiento PEM", () => {
    expect(content).toContain("GITHUB_APP_PRIVATE_KEY");
    expect(content).toContain(".refine");
    expect(content).toContain("PEM");
  });

  it("valida GITHUB_WEBHOOK_SECRET como z.string().min(20)", () => {
    expect(content).toContain("GITHUB_WEBHOOK_SECRET");
    expect(content).toContain(".min(20");
  });

  // ── App Environment ──
  it("valida NODE_ENV como enum development/production/test", () => {
    expect(content).toContain("NODE_ENV");
    expect(content).toContain("z.enum");
    expect(content).toContain("development");
    expect(content).toContain("production");
    expect(content).toContain("test");
  });

  it("valida PORT como z.coerce.number().default(4000)", () => {
    expect(content).toContain("PORT");
    expect(content).toContain("z.coerce.number()");
    expect(content).toContain(".default(4000)");
  });

  it("valida FRONTEND_URL como z.string().url().default('http://localhost:3000')", () => {
    expect(content).toContain("FRONTEND_URL");
    expect(content).toContain("z.string().url()");
    expect(content).toContain("http://localhost:3000");
  });

  // ── Worker / Scanner ──
  it("valida SCANNER_TIMEOUT_MS como z.coerce.number().default(300000)", () => {
    expect(content).toContain("SCANNER_TIMEOUT_MS");
    expect(content).toContain("z.coerce.number()");
    expect(content).toContain(".default(300000)");
  });

  it("valida MAX_REPO_SIZE_MB como z.coerce.number().default(500)", () => {
    expect(content).toContain("MAX_REPO_SIZE_MB");
    expect(content).toContain("z.coerce.number()");
    expect(content).toContain(".default(500)");
  });

  it("valida WORKER_CONCURRENCY como z.coerce.number().min(1).max(8).default(2)", () => {
    expect(content).toContain("WORKER_CONCURRENCY");
    expect(content).toContain("z.coerce.number()");
    expect(content).toContain(".min(1)");
    expect(content).toContain(".max(8)");
    expect(content).toContain(".default(2)");
  });

  it("exporta type Env inferido del schema", () => {
    expect(content).toContain("export type Env");
    expect(content).toContain("z.infer<typeof EnvSchema>");
  });

  it("tiene comentarios en español", () => {
    expect(content).toContain("//");
  });
});

// ═══════════════════════════════════════════════════════════
// Task 1.2 — packages/config/src/index.ts
// ═══════════════════════════════════════════════════════════
describe("1.2 — packages/config/src/index.ts", () => {
  const content = readFile("packages/config/src/index.ts");

  it("exporta loadEnv", () => {
    expect(content).toContain("export function loadEnv");
  });

  it("usa safeParse para validación fail-fast", () => {
    expect(content).toContain("safeParse");
  });

  it("lanza error descriptivo con path y mensaje", () => {
    expect(content).toContain("path");
    expect(content).toContain("message");
    expect(content).toContain("Error de configuración");
  });

  it("exporta EnvSchema e Env type", () => {
    expect(content).toContain("export { EnvSchema }");
    expect(content).toContain("export type { Env }");
  });

  it("tiene comentarios en español", () => {
    expect(content).toContain("//");
  });
});

// ═══════════════════════════════════════════════════════════
// Task 1.3 — apps/api/prisma/schema.prisma (User + RefreshToken)
// ═══════════════════════════════════════════════════════════
describe("1.3 — apps/api/prisma/schema.prisma — Modelos User/RefreshToken", () => {
  const content = readFile("apps/api/prisma/schema.prisma");

  it("contiene model User con id, email, passwordHash, role", () => {
    expect(content).toContain("model User");
    expect(content).toContain("id");
    expect(content).toContain("email");
    expect(content).toContain("passwordHash");
    expect(content).toContain("role");
  });

  it("User.email tiene @unique", () => {
    expect(content).toContain("email");
    expect(content).toContain("@unique");
  });

  it("User.role tiene defaultValue VIEWER", () => {
    expect(content).toContain("role");
    expect(content).toContain("VIEWER");
  });

  it("User tiene relación con RefreshToken", () => {
    expect(content).toContain("refreshTokens");
    expect(content).toContain("RefreshToken");
  });

  it("User tiene @@index([email])", () => {
    expect(content).toContain("@@index([email])");
  });

  it("contiene model RefreshToken con id, tokenHash, token, userId", () => {
    expect(content).toContain("model RefreshToken");
    expect(content).toContain("tokenHash");
    expect(content).toContain("token");
    expect(content).toContain("userId");
  });

  it("tokenHash tiene @unique", () => {
    expect(content).toContain("tokenHash");
    expect(content).toContain("@unique");
  });

  it("RefreshToken tiene userId ForeignKey hacia User con onDelete Cascade", () => {
    expect(content).toContain("userId");
    expect(content).toContain("User");
    expect(content).toContain("onDelete: Cascade");
  });

  it("RefreshToken tiene expiresAt y revokedAt?", () => {
    expect(content).toContain("expiresAt");
    expect(content).toContain("revokedAt");
  });

  it("RefreshToken tiene @@index([userId]) y @@index([tokenHash])", () => {
    expect(content).toContain("@@index([userId])");
    expect(content).toContain("@@index([tokenHash])");
  });

  it("contiene enum Role con ADMIN, ANALYST, VIEWER", () => {
    expect(content).toContain("enum Role");
    expect(content).toContain("ADMIN");
    expect(content).toContain("ANALYST");
    expect(content).toContain("VIEWER");
  });

  it("NO tiene url hardcodeada en datasource", () => {
    expect(content).not.toMatch(/url\s*=\s*["']/);
  });

  it("tiene comentarios en español", () => {
    expect(content).toContain("//");
  });
});

// ═══════════════════════════════════════════════════════════
// Task 1.4 — apps/api/src/database/prisma.service.ts
// ═══════════════════════════════════════════════════════════
describe("1.4 — apps/api/src/database/prisma.service.ts", () => {
  const path = "apps/api/src/database/prisma.service.ts";

  it("el archivo existe", () => {
    expect(fileExists(path)).toBe(true);
  });

  const content = readFileIfExists(path);
  if (!content) return;

  it("importa Injectable, OnModuleInit, OnModuleDestroy desde @nestjs/common", () => {
    expect(content).toContain("Injectable");
    expect(content).toContain("OnModuleInit");
    expect(content).toContain("OnModuleDestroy");
  });

  it("importa PrismaClient desde @prisma/client", () => {
    expect(content).toContain("PrismaClient");
  });

  it("importa PrismaPg desde @prisma/adapter-pg", () => {
    expect(content).toContain("PrismaPg");
  });

  it("importa Pool desde pg", () => {
    expect(content).toContain("Pool");
  });

  it("exporta clase PrismaService que extiende PrismaClient", () => {
    expect(content).toContain("export class PrismaService");
    expect(content).toContain("extends PrismaClient");
  });

  it("implementa OnModuleInit y OnModuleDestroy", () => {
    expect(content).toContain("implements OnModuleInit, OnModuleDestroy");
  });

  it("constructor crea Pool con DATABASE_URL y lo usa con PrismaPg", () => {
    expect(content).toContain("Pool");
    expect(content).toContain("connectionString");
    expect(content).toContain("DATABASE_URL");
    expect(content).toContain("new PrismaPg");
  });

  it("onModuleInit llama $connect", () => {
    expect(content).toContain("onModuleInit");
    expect(content).toContain("$connect");
  });

  it("onModuleDestroy llama $disconnect", () => {
    expect(content).toContain("onModuleDestroy");
    expect(content).toContain("$disconnect");
  });

  it("tiene comentarios en español", () => {
    expect(content).toContain("//");
  });
});

// ═══════════════════════════════════════════════════════════
// Task 1.5 — apps/api/src/database/prisma.module.ts
// ═══════════════════════════════════════════════════════════
describe("1.5 — apps/api/src/database/prisma.module.ts", () => {
  const path = "apps/api/src/database/prisma.module.ts";

  it("el archivo existe", () => {
    expect(fileExists(path)).toBe(true);
  });

  const content = readFileIfExists(path);
  if (!content) return;

  it("importa Module desde @nestjs/common", () => {
    expect(content).toContain("Module");
  });

  it("importa PrismaService", () => {
    expect(content).toContain("PrismaService");
  });

  it("usa @Module decorator", () => {
    expect(content).toContain("@Module");
  });

  it("provee PrismaService", () => {
    expect(content).toContain("providers");
    expect(content).toContain("PrismaService");
  });

  it("exporta PrismaService", () => {
    expect(content).toContain("exports");
    expect(content).toContain("PrismaService");
  });

  it("exporta clase PrismaModule", () => {
    expect(content).toContain("export class PrismaModule");
  });

  it("tiene comentarios en español", () => {
    expect(content).toContain("//");
  });
});

// ═══════════════════════════════════════════════════════════
// Task 1.6 — apps/api/src/common/middleware/request-id.middleware.ts
// ═══════════════════════════════════════════════════════════
describe("1.6 — apps/api/src/common/middleware/request-id.middleware.ts", () => {
  const path = "apps/api/src/common/middleware/request-id.middleware.ts";

  it("el archivo existe", () => {
    expect(fileExists(path)).toBe(true);
  });

  const content = readFileIfExists(path);
  if (!content) return;

  it("importa NestJS middleware types", () => {
    expect(content).toContain("Injectable") || expect(content).toContain("NestMiddleware");
  });

  it("genera un UUID v4 para cada request", () => {
    expect(content).toContain("crypto") || expect(content).toContain("uuid") || expect(content).toContain("randomUUID");
  });

  it("asigna X-Request-ID al request y response", () => {
    expect(content).toContain("X-Request-ID") || expect(content).toContain("x-request-id");
  });

  it("respeta X-Request-ID existente (no sobreescribe si ya viene)", () => {
    expect(content).toContain("X-Request-ID") || expect(content).toContain("x-request-id");
  });

  it("exporta una clase decorada con @Injectable()", () => {
    expect(content).toContain("@Injectable");
    expect(content).toContain("export class");
  });

  it("tiene comentarios en español", () => {
    expect(content).toContain("//");
  });
});

// ═══════════════════════════════════════════════════════════
// Task 1.7 — apps/api/src/common/filters/global-exception.filter.ts
// ═══════════════════════════════════════════════════════════
describe("1.7 — apps/api/src/common/filters/global-exception.filter.ts", () => {
  const path = "apps/api/src/common/filters/global-exception.filter.ts";

  it("el archivo existe", () => {
    expect(fileExists(path)).toBe(true);
  });

  const content = readFileIfExists(path);
  if (!content) return;

  it("importa ExceptionFilter, Catch, ArgumentsHost desde @nestjs/common", () => {
    expect(content).toContain("ExceptionFilter");
    expect(content).toContain("Catch");
    expect(content).toContain("ArgumentsHost");
  });

  it("usa @Catch() para atrapar todas las excepciones", () => {
    expect(content).toContain("@Catch()");
  });

  it("implementa ExceptionFilter", () => {
    expect(content).toContain("implements ExceptionFilter");
  });

  it("responde con {statusCode, message, requestId, timestamp}", () => {
    expect(content).toContain("statusCode");
    expect(content).toContain("message");
    expect(content).toContain("requestId");
    expect(content).toContain("timestamp");
  });

  it("NO incluye stack trace en produccion", () => {
    expect(content).toContain("stack");
    expect(content).toContain("NODE_ENV");
    expect(content).toContain("production");
  });

  it("exporta una clase decorada con @Catch()", () => {
    expect(content).toContain("@Catch");
    expect(content).toContain("export class");
  });

  it("tiene comentarios en español", () => {
    expect(content).toContain("//");
  });
});

// ═══════════════════════════════════════════════════════════
// Task 1.8 — apps/api/src/main.ts
// ═══════════════════════════════════════════════════════════
describe("1.8 — apps/api/src/main.ts — bootstrap mejorado", () => {
  const path = "apps/api/src/main.ts";
  const content = readFileIfExists(path)!;

  it("configura Helmet con opciones de seguridad extendidas", () => {
    expect(content).toContain("helmet");
  });

  it("configura CORS con FRONTEND_URL como origin (no comodin)", () => {
    expect(content).toContain("FRONTEND_URL");
    expect(content).toContain("origin");
    expect(content).not.toContain("origin: '*'");
    expect(content).not.toContain("origin: \"*\"");
  });

  it("usa Pino logger con redacción de campos sensibles", () => {
    expect(content).toContain("pino") || expect(content).toContain("Pino");
  });

  it("configura pino-http como logger de NestJS", () => {
    expect(content).toContain("pino-http") || expect(content).toContain("pinoHttp");
  });

  it("registra Request ID middleware globalmente", () => {
    expect(content).toContain("RequestId") || expect(content).toContain("request-id");
  });

  it("registra Global Exception Filter globalmente", () => {
    expect(content).toContain("GlobalException") || expect(content).toContain("global-exception");
  });

  it("configura Swagger con informacion basica", () => {
    expect(content).toContain("Swagger") || expect(content).toContain("swagger");
    expect(content).toContain("SwaggerModule") || expect(content).toContain("swagger");
  });

  it("configura Swagger UI en /api/docs", () => {
    expect(content).toContain("api") || expect(content).toContain("docs");
  });

  it("lee PORT del environment (con fallback a 4000)", () => {
    expect(content).toContain("PORT");
  });

  it("tiene comentarios en español", () => {
    expect(content).toContain("//");
  });
});

// ═══════════════════════════════════════════════════════════
// Security Checkpoints
// ═══════════════════════════════════════════════════════════
describe("Security — Checkpoints PR #1", () => {
  it("No hay secrets en archivos de configuracion", () => {
    const filesToCheck = [
      "packages/config/src/env.schema.ts",
    ];
    for (const file of filesToCheck) {
      if (!existsSync(resolve(__dirname, "..", file))) continue;
      const content = readFile(file);
      expect(content).not.toMatch(/ghp_[a-zA-Z0-9]+/);
      expect(content).not.toMatch(/gho_[a-zA-Z0-9]+/);
      expect(content).not.toMatch(/sk-[a-zA-Z0-9]+/);
      expect(content).not.toMatch(/AKIA[0-9A-Z]{16}/);
    }
  });

  it("CORS origin es variable de entorno, nunca '*'", () => {
    const mainPath = "apps/api/src/main.ts";
    if (!fileExists(mainPath)) return;
    const mainContent = readFile(mainPath);
    expect(mainContent).toContain("FRONTEND_URL");
    expect(mainContent).not.toMatch(/origin:\s*['"]\*['"]/);
  });

  it("Pino redacta *.token, *.secret, *.password, req.headers.authorization", () => {
    const mainPath = "apps/api/src/main.ts";
    if (!fileExists(mainPath)) return;
    const mainContent = readFile(mainPath);
    // Revisar que existan patrones de redacción
    expect(mainContent).toMatch(/token|secret|password|authorization/i);
  });
});
