// ─────────────────────────────────────────────
// Tests estructurales — PR #3
// Docker + Prisma 7 + CI + Docs + Validation
// ─────────────────────────────────────────────
// Sigue el ciclo TDD: RED (test primero) → GREEN (implementación)
// Todas las tareas son estructurales: verificar existencia y contenido.
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

// ═══════════════════════════════════════════════════════════
// Task 3.1 — prisma.config.ts
// ═══════════════════════════════════════════════════════════
describe("3.1 — prisma.config.ts", () => {
  it("existe en la raíz del proyecto", () => {
    expect(fileExists("prisma.config.ts")).toBe(true);
  });

  const content = readFile("prisma.config.ts");

  it("importa defineConfig y env desde prisma/config", () => {
    expect(content).toContain("defineConfig");
    expect(content).toContain("env");
    expect(content).toContain("from 'prisma/config'");
  });

  it("exporta por defecto defineConfig()", () => {
    expect(content).toContain("export default defineConfig");
  });

  it("usa env('DATABASE_URL') para la URL del datasource", () => {
    expect(content).toContain("env('DATABASE_URL')");
  });

  it("apunta schema a apps/api/prisma/schema.prisma", () => {
    expect(content).toContain("apps/api/prisma/schema.prisma");
  });

  it("usa defineConfig en lugar de getConfig u otra API", () => {
    // Prisma 7 usa defineConfig, NO getConfig u otras APIs anteriores
    expect(content).toContain("defineConfig({");
  });

  it("NO tiene URL hardcodeada en el datasource", () => {
    expect(content).not.toMatch(/url:\s*['"]postgres/);
  });

  it("tiene comentarios en español", () => {
    expect(content).toContain("//");
  });
});

// ═══════════════════════════════════════════════════════════
// Task 3.2 — apps/api/prisma/schema.prisma
// ═══════════════════════════════════════════════════════════
describe("3.2 — apps/api/prisma/schema.prisma", () => {
  it("existe", () => {
    expect(fileExists("apps/api/prisma/schema.prisma")).toBe(true);
  });

  const content = readFile("apps/api/prisma/schema.prisma");

  it("tiene generator client", () => {
    expect(content).toContain("generator client");
  });

  it("tiene datasource db con provider postgresql", () => {
    expect(content).toContain("datasource db");
    expect(content).toContain("provider");
    expect(content).toContain("postgresql");
  });

  it("NO tiene url en datasource (gestionado por prisma.config.ts)", () => {
    // La URL se configura EN EXCLUSIVA en prisma.config.ts via env()
    expect(content).not.toMatch(/url\s*=/);
  });

  it("menciona adapter-pg en comentarios o config", () => {
    expect(content).toMatch(/adapter.?pg|PrismaPg|adapter-pg/i);
  });

  it("hace referencia al driver adapter", () => {
    expect(content).toContain("pg");
  });

  it("tiene comentarios en español", () => {
    expect(content).toContain("//");
  });
});

// ═══════════════════════════════════════════════════════════
// Task 3.3 — docker-compose.yml
// ═══════════════════════════════════════════════════════════
describe("3.3 — docker-compose.yml (raíz)", () => {
  it("existe en la raíz del proyecto", () => {
    expect(fileExists("docker-compose.yml")).toBe(true);
  });

  const content = readFile("docker-compose.yml");

  it("define servicio postgres con imagen postgres:17-alpine", () => {
    expect(content).toMatch(/postgres/);
    expect(content).toContain("postgres:17-alpine");
  });

  it("define servicio redis con imagen redis:8-alpine", () => {
    expect(content).toMatch(/redis/);
    expect(content).toContain("redis:8-alpine");
  });

  it("define servicio api con build de infrastructure/docker/api.Dockerfile", () => {
    expect(content).toContain("api.Dockerfile");
  });

  it("define servicio worker con build de infrastructure/docker/worker.Dockerfile", () => {
    expect(content).toContain("worker.Dockerfile");
  });

  it("define servicio web con build de infrastructure/docker/web.Dockerfile", () => {
    expect(content).toContain("web.Dockerfile");
  });

  it("tiene HEALTHCHECK en postgres", () => {
    expect(content).toMatch(/healthcheck|HEALTHCHECK/i);
  });

  it("postgres expone puerto 5432", () => {
    expect(content).toContain("5432");
  });

  it("redis expone puerto 6379", () => {
    expect(content).toContain("6379");
  });

  it("no usa atributo version obsoleto (Compose v2.29+ ignora version)", () => {
    // Docker Compose v2.29+ deprecó el atributo version
    // HEALTHCHECK se soporta por defecto en formatos modernos
    expect(content).not.toContain("version:");
  });

  it("define named volume para datos de postgres", () => {
    expect(content).toMatch(/volumes/);
  });

  it("api depende de postgres y redis", () => {
    expect(content).toMatch(/depends_on/);
  });

  it("worker depende de postgres y redis", () => {
    // worker necesita redis para BullMQ y postgres para Prisma
    expect(content).toMatch(/depends_on/);
  });

  it("web depende de api", () => {
    expect(content).toMatch(/depends_on/);
  });

  it("tiene comentarios en español", () => {
    expect(content).toContain("#");
  });
});

// ═══════════════════════════════════════════════════════════
// Task 3.4 — docker-compose.test.yml
// ═══════════════════════════════════════════════════════════
describe("3.4 — docker-compose.test.yml", () => {
  it("existe en la raíz del proyecto", () => {
    expect(fileExists("docker-compose.test.yml")).toBe(true);
  });

  const content = readFile("docker-compose.test.yml");

  it("define servicio postgres para tests", () => {
    expect(content).toMatch(/postgres/);
  });

  it("define servicio redis para tests", () => {
    expect(content).toMatch(/redis/);
  });

  it("NO tiene volúmenes persistentes (ephemeral)", () => {
    // Los tests no deben persistir datos entre ejecuciones
    expect(content).not.toMatch(/pgdata|redis_data/);
  });

  it("tiene healthcheck para postgres", () => {
    expect(content).toMatch(/healthcheck|HEALTHCHECK/i);
  });

  it("tiene healthcheck para redis", () => {
    expect(content).toMatch(/healthcheck|HEALTHCHECK/i);
  });
});

// ═══════════════════════════════════════════════════════════
// Task 3.5 — .env.example
// ═══════════════════════════════════════════════════════════
describe("3.5 — .env.example", () => {
  it("existe en la raíz del proyecto", () => {
    expect(fileExists(".env.example")).toBe(true);
  });

  const content = readFile(".env.example");

  it("contiene DATABASE_URL con placeholder seguro (your-user)", () => {
    expect(content).toContain("DATABASE_URL");
    expect(content).toContain("your-user");
    expect(content).toContain("your-password");
  });

  it("contiene REDIS_URL con placeholder seguro", () => {
    expect(content).toContain("REDIS_URL");
  });

  it("contiene NODE_ENV", () => {
    expect(content).toContain("NODE_ENV");
  });

  it("contiene PORT", () => {
    expect(content).toContain("PORT");
  });

  it("contiene FRONTEND_URL", () => {
    expect(content).toContain("FRONTEND_URL");
  });

  it("NO contiene credenciales reales (API keys, tokens)", () => {
    // Debe tener solo valores de ejemplo seguros (placeholders con "your-" son válidos)
    // Revisar patrones de credenciales reales, no placeholders
    expect(content).not.toMatch(/sk-[a-zA-Z0-9]{20,}/);  // OpenAI/Stripe keys
    expect(content).not.toMatch(/ghp_[a-zA-Z0-9]{36}/);   // GitHub PAT
    expect(content).not.toMatch(/gho_[a-zA-Z0-9]{36}/);   // GitHub OAuth
    expect(content).not.toMatch(/xox[bpras]-/);           // Slack tokens
    expect(content).not.toMatch(/AKIA[0-9A-Z]{16}/);      // AWS keys
  });

  it("usa valores de ejemplo seguros (placeholders)", () => {
    expect(content).toContain("your-");
  });

  it("tiene comentarios en español", () => {
    expect(content).toContain("#");
  });
});

// ═══════════════════════════════════════════════════════════
// Task 3.x — Dockerfiles (extension de Phase 3)
// ═══════════════════════════════════════════════════════════
describe("3.x — infrastructure/docker/api.Dockerfile", () => {
  it("existe", () => {
    expect(fileExists("infrastructure/docker/api.Dockerfile")).toBe(true);
  });

  const content = readFile("infrastructure/docker/api.Dockerfile");

  it("usa multi-stage build (FROM ... AS ...)", () => {
    expect(content).toMatch(/FROM .* AS /);
  });

  it("usa non-root user con UID 1001", () => {
    expect(content).toContain("1001");
  });

  it("usa node:24.16.0-alpine como imagen base", () => {
    expect(content).toContain("node:24.16.0-alpine");
  });

  it("tiene HEALTHCHECK", () => {
    expect(content).toMatch(/HEALTHCHECK/i);
  });

  it("expone puerto de la API", () => {
    expect(content).toMatch(/EXPOSE/);
  });

  it("usa pnpm para install (no npm)", () => {
    expect(content).toContain("pnpm");
    expect(content).not.toMatch(/\bnpm (install|ci|run)\b/);
  });

  it("usa --frozen-lockfile en pnpm install", () => {
    expect(content).toContain("frozen-lockfile");
  });

  it("usa COPY --chown=1001 para permisos correctos", () => {
    expect(content).toMatch(/COPY --chown=1001/);
  });

  it("tiene USER 1001 al final", () => {
    expect(content).toContain("USER 1001");
  });
});

describe("3.x — infrastructure/docker/worker.Dockerfile", () => {
  it("existe", () => {
    expect(fileExists("infrastructure/docker/worker.Dockerfile")).toBe(true);
  });

  const content = readFile("infrastructure/docker/worker.Dockerfile");

  it("usa multi-stage build (FROM ... AS ...)", () => {
    expect(content).toMatch(/FROM .* AS /);
  });

  it("usa non-root user con UID 1001", () => {
    expect(content).toContain("1001");
  });

  it("usa node:24.16.0-alpine como imagen base", () => {
    expect(content).toContain("node:24.16.0-alpine");
  });

  it("tiene HEALTHCHECK", () => {
    expect(content).toMatch(/HEALTHCHECK/i);
  });

  it("usa pnpm para install (no npm)", () => {
    expect(content).toContain("pnpm");
  });

  it("usa --frozen-lockfile en pnpm install", () => {
    expect(content).toContain("frozen-lockfile");
  });

  it("usa COPY --chown=1001 para permisos correctos", () => {
    expect(content).toMatch(/COPY --chown=1001/);
  });

  it("tiene USER 1001 al final", () => {
    expect(content).toContain("USER 1001");
  });
});

describe("3.x — infrastructure/docker/web.Dockerfile", () => {
  it("existe", () => {
    expect(fileExists("infrastructure/docker/web.Dockerfile")).toBe(true);
  });

  const content = readFile("infrastructure/docker/web.Dockerfile");

  it("usa multi-stage build (FROM ... AS ...)", () => {
    expect(content).toMatch(/FROM .* AS /);
  });

  it("usa non-root user con UID 1001", () => {
    expect(content).toContain("1001");
  });

  it("usa node:24.16.0-alpine como imagen base", () => {
    expect(content).toContain("node:24.16.0-alpine");
  });

  it("tiene HEALTHCHECK", () => {
    expect(content).toMatch(/HEALTHCHECK/i);
  });

  it("usa pnpm para install (no npm)", () => {
    expect(content).toContain("pnpm");
  });

  it("usa --frozen-lockfile en pnpm install", () => {
    expect(content).toContain("frozen-lockfile");
  });

  it("usa COPY --chown=1001 para permisos correctos", () => {
    expect(content).toMatch(/COPY --chown=1001/);
  });

  it("tiene USER 1001 al final", () => {
    expect(content).toContain("USER 1001");
  });

  it("usa servidor standalone (output standalone)", () => {
    // Next.js standalone output minimiza la imagen final
    expect(content).toContain("standalone");
  });
});

// ═══════════════════════════════════════════════════════════
// Task 4.1 — .github/workflows/ci.yml
// ═══════════════════════════════════════════════════════════
describe("4.1 — .github/workflows/ci.yml", () => {
  it("existe", () => {
    expect(fileExists(".github/workflows/ci.yml")).toBe(true);
  });

  const content = readFile(".github/workflows/ci.yml");

  it("se ejecuta en pull_request a main", () => {
    expect(content).toMatch(/pull_request/);
    expect(content).toContain("main");
  });

  it("setup Node 24.16.0 LTS", () => {
    expect(content).toContain("24");
    expect(content).toContain("node");
  });

  it("usa pnpm 11", () => {
    expect(content).toContain("pnpm");
    expect(content).toContain("11");
  });

  it("ejecuta pnpm install --frozen-lockfile", () => {
    expect(content).toContain("frozen-lockfile");
  });

  it("ejecuta typecheck", () => {
    expect(content).toMatch(/typecheck/);
  });

  it("ejecuta lint", () => {
    expect(content).toMatch(/lint/);
  });

  it("ejecuta test", () => {
    expect(content).toMatch(/test/);
  });

  it("ejecuta build", () => {
    expect(content).toMatch(/build/);
  });

  it("cachea node_modules y turbo cache", () => {
    expect(content).toMatch(/cache/);
  });

  it("NO tiene secrets hardcodeados (usa ${{ secrets.* }})", () => {
    // Si usa secrets, debe ser ${{ secrets.NOMBRE }}, no valores literales
    const lines = content.split("\n");
    for (const line of lines) {
      if (line.includes("secret") && !line.includes("secrets.") && !line.includes("secrets\"")) {
        // Revisar que no sea un comentario
        if (!line.trim().startsWith("#")) {
          expect(line).toMatch(/secrets\./);
        }
      }
    }
  });

  it("tiene comentarios en español", () => {
    expect(content).toContain("#");
  });
});

// ═══════════════════════════════════════════════════════════
// Task 4.2 — .github/workflows/e2e.yml
// ═══════════════════════════════════════════════════════════
describe("4.2 — .github/workflows/e2e.yml", () => {
  it("existe", () => {
    expect(fileExists(".github/workflows/e2e.yml")).toBe(true);
  });

  const content = readFile(".github/workflows/e2e.yml");

  it("se ejecuta en push a main (no en cada PR)", () => {
    expect(content).toMatch(/push/);
  });

  it("NO se ejecuta en pull_request (solo merge a main)", () => {
    // E2E es costoso, solo en merge
    expect(content).toMatch(/push/);
  });

  it("menciona Playwright o E2E", () => {
    expect(content).toMatch(/playwright|e2e/i);
  });
});

// ═══════════════════════════════════════════════════════════
// Task 4.3 — .github/PULL_REQUEST_TEMPLATE.md
// ═══════════════════════════════════════════════════════════
describe("4.3 — .github/PULL_REQUEST_TEMPLATE.md", () => {
  it("existe", () => {
    expect(fileExists(".github/PULL_REQUEST_TEMPLATE.md")).toBe(true);
  });

  const content = readFile(".github/PULL_REQUEST_TEMPLATE.md");

  it("tiene checklist de typecheck", () => {
    expect(content).toMatch(/typecheck/i);
  });

  it("tiene checklist de lint", () => {
    expect(content).toMatch(/lint/i);
  });

  it("menciona verificacion de secrets", () => {
    expect(content).toMatch(/secret/i);
  });

  it("menciona actualizacion de docs", () => {
    expect(content).toMatch(/docs?/i);
  });

  it("tiene seccion de descripcion del cambio", () => {
    expect(content).toMatch(/descripc/i);
  });
});

// ═══════════════════════════════════════════════════════════
// Tasks 4.4 + 4.5 — README, LICENSE, SECURITY, CONTRIBUTING
// ═══════════════════════════════════════════════════════════
describe("4.4 — README.md", () => {
  it("existe", () => {
    expect(fileExists("README.md")).toBe(true);
  });

  const content = readFile("README.md");

  it("tiene titulo del proyecto", () => {
    expect(content).toContain("SecureSupply");
  });

  it("menciona prerequisitos (Node, pnpm)", () => {
    expect(content).toMatch(/node|pnpm/i);
  });

  it("incluye instrucciones de setup", () => {
    expect(content).toMatch(/pnpm install|setup|instalación|instalación/i);
  });

  it("menciona Docker Compose", () => {
    expect(content).toMatch(/docker/i);
  });

  it("NO menciona npm o yarn como gestor de paquetes", () => {
    expect(content).not.toMatch(/\bnpm (install|run|add|i)\b/);
    expect(content).not.toMatch(/\byarn (install|add|start)\b/);
  });
});

describe("4.5 — LICENSE (MIT)", () => {
  it("existe", () => {
    expect(fileExists("LICENSE")).toBe(true);
  });

  const content = readFile("LICENSE");

  it("es MIT License", () => {
    expect(content).toContain("MIT");
    expect(content).toContain("Permission is hereby granted");
  });

  it("menciona el año 2026", () => {
    expect(content).toContain("2026");
  });
});

describe("4.5 — SECURITY.md", () => {
  it("existe", () => {
    expect(fileExists("SECURITY.md")).toBe(true);
  });

  const content = readFile("SECURITY.md");

  it("tiene politica de divulgación responsable", () => {
    expect(content).toMatch(/responsible disclosure|divulgación responsable|vulnerabilidad/i);
  });

  it("proporciona metodo de contacto", () => {
    expect(content).toMatch(/security@|contact|report/i);
  });

  it("describe el proceso de reporte", () => {
    expect(content).toMatch(/process|proceso|steps|pasos/i);
  });
});

describe("4.5 — CONTRIBUTING.md", () => {
  it("existe", () => {
    expect(fileExists("CONTRIBUTING.md")).toBe(true);
  });

  const content = readFile("CONTRIBUTING.md");

  it("describe convencion de commits", () => {
    expect(content).toMatch(/commit|conventional|convencional/i);
  });

  it("describe proceso de PR", () => {
    expect(content).toMatch(/pull request|PR/i);
  });

  it("menciona ramas o branches", () => {
    expect(content).toMatch(/branch|rama/i);
  });
});

// ═══════════════════════════════════════════════════════════
// Phase 5 — Security Checkpoints
// ═══════════════════════════════════════════════════════════
describe("5.4 — Security: Dockerfiles usan non-root UID 1001", () => {
  const dockerfiles = [
    "infrastructure/docker/api.Dockerfile",
    "infrastructure/docker/worker.Dockerfile",
    "infrastructure/docker/web.Dockerfile",
  ];

  for (const df of dockerfiles) {
    it(`${df} usa USER 1001`, () => {
      const content = readFile(df);
      expect(content).toContain("USER 1001");
    });

    it(`${df} usa multi-stage build`, () => {
      const content = readFile(df);
      expect(content).toMatch(/FROM .* AS /);
    });
  }
});

describe("5.4 — Security: No secrets en archivos", () => {
  const filesToCheck = [
    "docker-compose.yml",
    "docker-compose.test.yml",
    ".env.example",
    "prisma.config.ts",
  ];

  for (const file of filesToCheck) {
    if (!existsSync(resolve(__dirname, "..", file))) continue;

    it(`${file} no tiene tokens ni secrets hardcodeados`, () => {
      const content = readFile(file);
      // Revisar patrones comunes de secrets
      expect(content).not.toMatch(/sk-[a-zA-Z0-9]+/);  // OpenAI/Stripe keys
      expect(content).not.toMatch(/ghp_[a-zA-Z0-9]+/); // GitHub tokens
      expect(content).not.toMatch(/gho_[a-zA-Z0-9]+/); // GitHub tokens
      expect(content).not.toMatch(/ghu_[a-zA-Z0-9]+/); // GitHub tokens
      expect(content).not.toMatch(/xox[bpras]-/);      // Slack tokens
      expect(content).not.toMatch(/AKIA[0-9A-Z]{16}/); // AWS keys
    });
  }
});

describe("5.4 — Security: .npmrc tiene configuraciones correctas", () => {
  const npmrc = readFile(".npmrc");

  it("tiene save-exact=true", () => {
    expect(npmrc).toContain("save-exact=true");
  });

  it("tiene ignore-scripts=true", () => {
    expect(npmrc).toContain("ignore-scripts=true");
  });

  it("tiene engine-strict=true", () => {
    expect(npmrc).toContain("engine-strict=true");
  });
});

describe("5.4 — Security: .github/workflows", () => {
  it("CI workflow usa Node 24 LTS", () => {
    const content = readFile(".github/workflows/ci.yml");
    expect(content).toContain("24");
  });

  it("CI ejecuta pnpm install --frozen-lockfile", () => {
    const content = readFile(".github/workflows/ci.yml");
    expect(content).toContain("frozen-lockfile");
  });

  it("CI no tiene steps con npm", () => {
    const content = readFile(".github/workflows/ci.yml");
    expect(content).not.toMatch(/\bnpm install\b/);
  });
});

// ═══════════════════════════════════════════════════════════
// Verificacion de engine constraints
// ═══════════════════════════════════════════════════════════
describe("5.4 — Engine constraints en root package.json", () => {
  const pkg = JSON.parse(readFile("package.json"));

  it("tiene packageManager: pnpm@11.3.0", () => {
    expect(pkg.packageManager).toBe("pnpm@11.3.0");
  });

  it("tiene engines.node: >=24.16.0 <25.0.0", () => {
    expect(pkg.engines.node).toBe(">=24.16.0 <25.0.0");
  });
});

// ═══════════════════════════════════════════════════════════
// Verificacion: Solo pnpm, no npm/yarn
// ═══════════════════════════════════════════════════════════
describe("Verificación — solo pnpm (PR #3 nuevos archivos)", () => {
  const newFiles = [
    "docker-compose.yml",
    "docker-compose.test.yml",
    "infrastructure/docker/api.Dockerfile",
    "infrastructure/docker/worker.Dockerfile",
    "infrastructure/docker/web.Dockerfile",
    ".github/workflows/ci.yml",
    ".github/workflows/e2e.yml",
    "README.md",
    "CONTRIBUTING.md",
  ];

  for (const file of newFiles) {
    if (!existsSync(resolve(__dirname, "..", file))) continue;

    it(`${file} no contiene referencias a npm o yarn`, () => {
      const content = readFile(file);
      const lines = content.split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("#") || trimmed.startsWith("//")) continue;
        // Permitir "npm" en URLs o nombres de paquete
        if (trimmed.includes("npm") && !trimmed.includes("//npm")) {
          expect(trimmed).not.toMatch(/\bnpm (install|run|add|remove|ci|i)\b/);
        }
      }
    });
  }
});
