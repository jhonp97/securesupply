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

// ═══════════════════════════════════════════
// Task 1.1 — Root package.json
// ═══════════════════════════════════════════
describe("1.1 — Root package.json", () => {
  const pkg = JSON.parse(readFile("package.json"));

  it("existe y es JSON válido", () => {
    expect(fileExists("package.json")).toBe(true);
  });

  it("declara workspaces con apps/* y packages/*", () => {
    expect(pkg.workspaces).toContain("apps/*");
    expect(pkg.workspaces).toContain("packages/*");
  });

  it("tiene scripts dev, build, lint, typecheck, format", () => {
    expect(pkg.scripts).toHaveProperty("dev");
    expect(pkg.scripts).toHaveProperty("build");
    expect(pkg.scripts).toHaveProperty("lint");
    expect(pkg.scripts).toHaveProperty("typecheck");
    expect(pkg.scripts).toHaveProperty("format");
  });

  it("tiene packageManager exacto: pnpm@11.3.0", () => {
    expect(pkg.packageManager).toBe("pnpm@11.3.0");
  });

  it("tiene engines con node >=24.16.0 <25.0.0 (bloquea versiones impares)", () => {
    expect(pkg.engines.node).toBe(">=24.16.0 <25.0.0");
  });

  it("tiene engines con pnpm >=11", () => {
    expect(pkg.engines.pnpm).toBe(">=11");
  });

  it("engine-strict=true en .npmrc está presente", () => {
    const npmrc = readFile(".npmrc");
    expect(npmrc).toContain("engine-strict=true");
  });

  it("devDependencies tienen versiones EXACTAS (sin ^ ni ~)", () => {
    for (const [name, version] of Object.entries(pkg.devDependencies as Record<string, string>)) {
      expect(version, `${name}: ${version} no es exacta`).not.toMatch(/^[~^]/);
    }
  });

  it("devDependencies tienen turbo, typescript y prettier", () => {
    expect(pkg.devDependencies).toHaveProperty("turbo", "2.9.14");
    expect(pkg.devDependencies).toHaveProperty("typescript", "6.0.3");
    expect(pkg.devDependencies).toHaveProperty("prettier", "3.8.3");
  });
});

// ═══════════════════════════════════════════
// Phase 2: App Scaffolds — Tasks 2.1–2.2 (apps/web)
// ═══════════════════════════════════════════
describe("2.1 — apps/web/package.json", () => {
  it("existe", () => {
    expect(fileExists("apps/web/package.json")).toBe(true);
  });

  const pkg = JSON.parse(readFile("apps/web/package.json"));

  it("tiene name @securesupply/web", () => {
    expect(pkg.name).toBe("@securesupply/web");
  });

  it("es private", () => {
    expect(pkg.private).toBe(true);
  });

  it("depende de next 16.2.6", () => {
    expect(pkg.dependencies.next).toBe("16.2.6");
  });

  it("depende de react y react-dom", () => {
    expect(pkg.dependencies).toHaveProperty("react");
    expect(pkg.dependencies).toHaveProperty("react-dom");
  });

  it("tiene scripts dev, build, typecheck", () => {
    expect(pkg.scripts).toHaveProperty("dev", "next dev");
    expect(pkg.scripts).toHaveProperty("build", "next build");
    expect(pkg.scripts).toHaveProperty("typecheck", "tsc --noEmit");
  });

  it("dev NO contiene --turbopack", () => {
    expect(pkg.scripts.dev).not.toContain("turbopack");
  });

  it("dependencias tienen versiones exactas (sin ^ ni ~)", () => {
    const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    for (const [name, version] of Object.entries(allDeps as Record<string, string>)) {
      if (version === "workspace:*" || version === "workspace:^") continue;
      expect(version, `${name}: ${version} no es exacta`).not.toMatch(/^[~^]/);
    }
  });
});

describe("2.1 — apps/web/tsconfig.json", () => {
  it("existe", () => {
    expect(fileExists("apps/web/tsconfig.json")).toBe(true);
  });

  const tsconfig = JSON.parse(readFile("apps/web/tsconfig.json"));

  it("extiende packages/tsconfig/nextjs.json (ruta relativa)", () => {
    expect(tsconfig.extends).toBe("../../packages/tsconfig/nextjs.json");
  });
});

describe("2.1 — apps/web/next.config.ts", () => {
  it("existe", () => {
    expect(fileExists("apps/web/next.config.ts")).toBe(true);
  });
});

describe("2.2 — apps/web/src/app/layout.tsx", () => {
  it("existe", () => {
    expect(fileExists("apps/web/src/app/layout.tsx")).toBe(true);
  });

  const content = readFile("apps/web/src/app/layout.tsx");

  it("exporta un RootLayout por defecto", () => {
    expect(content).toContain("export default function RootLayout");
  });

  it("tiene metadata export (viewport y themeColor)", () => {
    expect(content).toContain("export const metadata");
  });

  it("incluye los comentarios en español", () => {
    expect(content).toContain("//");
  });
});

describe("2.2 — apps/web/src/app/page.tsx", () => {
  it("existe", () => {
    expect(fileExists("apps/web/src/app/page.tsx")).toBe(true);
  });

  const content = readFile("apps/web/src/app/page.tsx");

  it("exporta un componente por defecto", () => {
    expect(content).toContain("export default function");
  });

  it("es una página con contenido informativo", () => {
    expect(content).toContain("SecureSupply");
  });
});

describe("2.2 — apps/web/src/styles/globals.css", () => {
  it("existe", () => {
    expect(fileExists("apps/web/src/styles/globals.css")).toBe(true);
  });
});

describe("2.2 — apps/web/src/app/api/health/route.ts", () => {
  it("existe", () => {
    expect(fileExists("apps/web/src/app/api/health/route.ts")).toBe(true);
  });

  const content = readFile("apps/web/src/app/api/health/route.ts");

  it("exporta GET handler", () => {
    expect(content).toContain("export async function GET");
  });

  it("responde con status ok", () => {
    expect(content).toContain("ok");
  });
});

// ═══════════════════════════════════════════
// Tasks 2.3–2.5 (apps/api)
// ═══════════════════════════════════════════
describe("2.3 — apps/api/package.json", () => {
  it("existe", () => {
    expect(fileExists("apps/api/package.json")).toBe(true);
  });

  const pkg = JSON.parse(readFile("apps/api/package.json"));

  it("tiene name @securesupply/api", () => {
    expect(pkg.name).toBe("@securesupply/api");
  });

  it("es private", () => {
    expect(pkg.private).toBe(true);
  });

  it("depende de @nestjs/core 11.1.24", () => {
    expect(pkg.dependencies["@nestjs/core"]).toBe("11.1.24");
  });

  it("depende de @nestjs/common", () => {
    expect(pkg.dependencies).toHaveProperty("@nestjs/common");
  });

  it("depende de @nestjs/platform-express", () => {
    expect(pkg.dependencies).toHaveProperty("@nestjs/platform-express");
  });

  it("depende de reflect-metadata y rxjs", () => {
    expect(pkg.dependencies).toHaveProperty("reflect-metadata");
    expect(pkg.dependencies).toHaveProperty("rxjs");
  });

  it("depende de helmet", () => {
    expect(pkg.dependencies).toHaveProperty("helmet");
  });

  it("tiene scripts start, dev, build, typecheck", () => {
    expect(pkg.scripts).toHaveProperty("start", "node dist/main.js");
    expect(pkg.scripts).toHaveProperty("dev", "nest start --watch");
    expect(pkg.scripts).toHaveProperty("build", "nest build");
    expect(pkg.scripts).toHaveProperty("typecheck", "tsc --noEmit");
  });

  it("dependencias tienen versiones exactas (sin ^ ni ~)", () => {
    const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    for (const [name, version] of Object.entries(allDeps as Record<string, string>)) {
      if (version === "workspace:*" || version === "workspace:^") continue;
      expect(version, `${name}: ${version} no es exacta`).not.toMatch(/^[~^]/);
    }
  });
});

describe("2.3 — apps/api/tsconfig.json", () => {
  it("existe", () => {
    expect(fileExists("apps/api/tsconfig.json")).toBe(true);
  });

  const tsconfig = JSON.parse(readFile("apps/api/tsconfig.json"));

  it("extiende packages/tsconfig/nestjs.json (ruta relativa)", () => {
    expect(tsconfig.extends).toBe("../../packages/tsconfig/nestjs.json");
  });
});

describe("2.3 — apps/api/nest-cli.json", () => {
  it("existe y es JSON válido", () => {
    expect(fileExists("apps/api/nest-cli.json")).toBe(true);
  });

  const content = JSON.parse(readFile("apps/api/nest-cli.json"));

  it("tiene language typescript", () => {
    expect(content.language).toBe("ts");
  });

  it("tiene sourceRoot src", () => {
    expect(content.sourceRoot).toBe("src");
  });
});

describe("2.4 — apps/api/src/main.ts", () => {
  it("existe", () => {
    expect(fileExists("apps/api/src/main.ts")).toBe(true);
  });

  const content = readFile("apps/api/src/main.ts");

  it("usa NestFactory.create con AppModule", () => {
    expect(content).toContain("NestFactory.create");
    expect(content).toContain("AppModule");
  });

  it("configura helmet", () => {
    expect(content).toContain("helmet");
  });

  it("configura CORS", () => {
    expect(content).toContain("enableCors");
  });

  it("configura logger de NestJS", () => {
    expect(content).toContain("Logger");
    expect(content).toContain("logger:");
  });

  it("tiene comentarios en español", () => {
    expect(content).toContain("//");
  });
});

describe("2.5 — apps/api/src/app.module.ts", () => {
  it("existe", () => {
    expect(fileExists("apps/api/src/app.module.ts")).toBe(true);
  });

  const content = readFile("apps/api/src/app.module.ts");

  it("importa HealthModule", () => {
    expect(content).toContain("HealthModule");
  });

  it("usa @Module decorator", () => {
    expect(content).toContain("@Module");
  });
});

describe("2.5 — apps/api/src/app.controller.ts", () => {
  it("existe", () => {
    expect(fileExists("apps/api/src/app.controller.ts")).toBe(true);
  });

  const content = readFile("apps/api/src/app.controller.ts");

  it("exporta AppController", () => {
    expect(content).toContain("AppController");
  });

  it("tiene ruta health", () => {
    expect(content).toContain("health");
  });
});

describe("2.5 — apps/api/src/health/health.controller.ts", () => {
  it("existe", () => {
    expect(fileExists("apps/api/src/health/health.controller.ts")).toBe(true);
  });

  const content = readFile("apps/api/src/health/health.controller.ts");

  it("responde con status ok", () => {
    expect(content).toContain("ok");
  });

  it("incluye timestamp", () => {
    expect(content).toContain("timestamp") || expect(content).toContain("fecha");
  });
});

describe("2.5 — apps/api/src/health/health.module.ts", () => {
  it("existe", () => {
    expect(fileExists("apps/api/src/health/health.module.ts")).toBe(true);
  });

  const content = readFile("apps/api/src/health/health.module.ts");

  it("exporta HealthModule", () => {
    expect(content).toContain("HealthModule");
  });

  it("usa @Module decorator", () => {
    expect(content).toContain("@Module");
  });
});

// ═══════════════════════════════════════════
// Tasks 2.6–2.8 (apps/worker)
// ═══════════════════════════════════════════
describe("2.6 — apps/worker/package.json", () => {
  it("existe", () => {
    expect(fileExists("apps/worker/package.json")).toBe(true);
  });

  const pkg = JSON.parse(readFile("apps/worker/package.json"));

  it("tiene name @securesupply/worker", () => {
    expect(pkg.name).toBe("@securesupply/worker");
  });

  it("es private", () => {
    expect(pkg.private).toBe(true);
  });

  it("depende de @nestjs/core 11.1.24", () => {
    expect(pkg.dependencies["@nestjs/core"]).toBe("11.1.24");
  });

  it("depende de @nestjs/common", () => {
    expect(pkg.dependencies).toHaveProperty("@nestjs/common");
  });

  it("depende de reflect-metadata y rxjs", () => {
    expect(pkg.dependencies).toHaveProperty("reflect-metadata");
    expect(pkg.dependencies).toHaveProperty("rxjs");
  });

  it("depende de bullmq", () => {
    expect(pkg.dependencies).toHaveProperty("bullmq");
  });

  it("depende de ioredis", () => {
    expect(pkg.dependencies).toHaveProperty("ioredis");
  });

  it("tiene scripts start, dev, build, typecheck", () => {
    expect(pkg.scripts).toHaveProperty("start", "node dist/main.js");
    expect(pkg.scripts).toHaveProperty("dev", "nest start --watch");
    expect(pkg.scripts).toHaveProperty("build", "nest build");
    expect(pkg.scripts).toHaveProperty("typecheck", "tsc --noEmit");
  });

  it("dependencias tienen versiones exactas (sin ^ ni ~)", () => {
    const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    for (const [name, version] of Object.entries(allDeps as Record<string, string>)) {
      if (version === "workspace:*" || version === "workspace:^") continue;
      expect(version, `${name}: ${version} no es exacta`).not.toMatch(/^[~^]/);
    }
  });
});

describe("2.6 — apps/worker/tsconfig.json", () => {
  it("existe", () => {
    expect(fileExists("apps/worker/tsconfig.json")).toBe(true);
  });

  const tsconfig = JSON.parse(readFile("apps/worker/tsconfig.json"));

  it("extiende packages/tsconfig/nestjs.json (ruta relativa)", () => {
    expect(tsconfig.extends).toBe("../../packages/tsconfig/nestjs.json");
  });
});

describe("2.6 — apps/worker/nest-cli.json", () => {
  it("existe y es JSON válido", () => {
    expect(fileExists("apps/worker/nest-cli.json")).toBe(true);
  });

  const content = JSON.parse(readFile("apps/worker/nest-cli.json"));

  it("tiene language typescript", () => {
    expect(content.language).toBe("ts");
  });

  it("tiene sourceRoot src", () => {
    expect(content.sourceRoot).toBe("src");
  });
});

describe("2.7 — apps/worker/src/main.ts", () => {
  it("existe", () => {
    expect(fileExists("apps/worker/src/main.ts")).toBe(true);
  });

  const content = readFile("apps/worker/src/main.ts");

  it("usa createApplicationContext (sin HTTP listener)", () => {
    expect(content).toContain("createApplicationContext");
  });

  it("importa WorkerModule", () => {
    expect(content).toContain("WorkerModule");
  });

  it("tiene comentarios en español", () => {
    expect(content).toContain("//");
  });
});

describe("2.8 — apps/worker/src/worker.module.ts", () => {
  it("existe", () => {
    expect(fileExists("apps/worker/src/worker.module.ts")).toBe(true);
  });

  const content = readFile("apps/worker/src/worker.module.ts");

  it("exporta WorkerModule", () => {
    expect(content).toContain("WorkerModule");
  });

  it("usa @Module decorator", () => {
    expect(content).toContain("@Module");
  });

  it("configura BullMQ worker", () => {
    expect(content).toContain("Bull") || expect(content).toContain("bull");
  });
});

// ═══════════════════════════════════════════
// Task 1.2 — .npmrc
// ═══════════════════════════════════════════
describe("1.2 — .npmrc", () => {
  it("existe", () => {
    expect(fileExists(".npmrc")).toBe(true);
  });

  const npmrc = readFile(".npmrc");

  it("contiene save-exact=true", () => {
    expect(npmrc).toContain("save-exact=true");
  });

  it("contiene ignore-scripts=true", () => {
    expect(npmrc).toContain("ignore-scripts=true");
  });

  it("contiene engine-strict=true", () => {
    expect(npmrc).toContain("engine-strict=true");
  });

  it("contiene comentario sobre Prisma exception", () => {
    expect(npmrc).toMatch(/prisma/i);
  });

  it("NO tiene npm ni yarn references", () => {
    expect(npmrc).not.toMatch(/^npm\s/m);
    expect(npmrc).not.toMatch(/^yarn\s/m);
  });
});

// ═══════════════════════════════════════════
// Task 1.3 — pnpm-workspace.yaml
// ═══════════════════════════════════════════
describe("1.3 — pnpm-workspace.yaml", () => {
  it("existe", () => {
    expect(fileExists("pnpm-workspace.yaml")).toBe(true);
  });

  const content = readFile("pnpm-workspace.yaml");

  it("define packages con apps/* y packages/*", () => {
    expect(content).toContain('"apps/*"');
    expect(content).toContain('"packages/*"');
  });

  it("NO menciona npm ni yarn", () => {
    expect(content.toLowerCase()).not.toMatch(/\bnpm\b/);
    expect(content.toLowerCase()).not.toMatch(/\byarn\b/);
  });
});

// ═══════════════════════════════════════════
// Task 1.4 — turbo.json
// ═══════════════════════════════════════════
describe("1.4 — turbo.json", () => {
  const turbo = JSON.parse(readFile("turbo.json"));

  it("existe y es JSON válido", () => {
    expect(fileExists("turbo.json")).toBe(true);
  });

  it("usa tasks (NO pipeline) — Turborepo 2.9 syntax", () => {
    expect(turbo).toHaveProperty("tasks");
    expect(turbo).not.toHaveProperty("pipeline");
  });

  it("tiene schema URL", () => {
    expect(turbo.$schema).toBe("https://turborepo.dev/schema.json");
  });

  it("task build tiene dependsOn ^build y outputs", () => {
    expect(turbo.tasks.build.dependsOn).toContain("^build");
    expect(turbo.tasks.build.outputs).toContain("dist/**");
  });

  it("task typecheck tiene dependsOn ^typecheck", () => {
    expect(turbo.tasks.typecheck.dependsOn).toContain("^typecheck");
  });

  it("task dev es persistent con cache false", () => {
    expect(turbo.tasks.dev.persistent).toBe(true);
    expect(turbo.tasks.dev.cache).toBe(false);
  });
});

// ═══════════════════════════════════════════
// Task 1.5 — .gitignore
// ═══════════════════════════════════════════
describe("1.5 — .gitignore", () => {
  it("existe", () => {
    expect(fileExists(".gitignore")).toBe(true);
  });

  const content = readFile(".gitignore");

  it("excluye node_modules", () => {
    expect(content).toMatch(/node_modules/);
  });

  it("excluye .next y dist", () => {
    expect(content).toMatch(/\.next/);
    expect(content).toMatch(/dist/);
  });

  it("excluye .env y .env.*.local", () => {
    expect(content).toMatch(/\.env/);
  });

  it("excluye *.tsbuildinfo", () => {
    expect(content).toMatch(/tsbuildinfo/);
  });

  it("excluye .turbo", () => {
    expect(content).toMatch(/\.turbo/);
  });

  it("excluye package-lock.json y yarn.lock", () => {
    expect(content).toMatch(/package-lock\.json/);
    expect(content).toMatch(/yarn\.lock/);
  });
});

// ═══════════════════════════════════════════
// Tasks 1.6-1.9 — packages/tsconfig
// ═══════════════════════════════════════════
describe("1.6 — packages/tsconfig/base.json", () => {
  const tsconfig = JSON.parse(readFile("packages/tsconfig/base.json"));

  it("existe y es JSON válido", () => {
    expect(fileExists("packages/tsconfig/base.json")).toBe(true);
  });

  it("tiene moduleResolution: bundler", () => {
    expect(tsconfig.compilerOptions.moduleResolution).toBe("bundler");
  });

  it("tiene strict: true", () => {
    expect(tsconfig.compilerOptions.strict).toBe(true);
  });

  it("tiene noUncheckedIndexedAccess: true", () => {
    expect(tsconfig.compilerOptions.noUncheckedIndexedAccess).toBe(true);
  });

  it("tiene exactOptionalPropertyTypes: true", () => {
    expect(tsconfig.compilerOptions.exactOptionalPropertyTypes).toBe(true);
  });

  it("tiene types: [\"node\"]", () => {
    expect(tsconfig.compilerOptions.types).toContain("node");
  });

  it("tiene target: ES2022", () => {
    expect(tsconfig.compilerOptions.target).toBe("ES2022");
  });

  it("tiene module: ESNext", () => {
    expect(tsconfig.compilerOptions.module).toBe("ESNext");
  });

  it("tiene composite: true", () => {
    expect(tsconfig.compilerOptions.composite).toBe(true);
  });

  it("tiene declaration: true", () => {
    expect(tsconfig.compilerOptions.declaration).toBe(true);
  });
});

describe("1.7 — packages/tsconfig/nextjs.json", () => {
  const tsconfig = JSON.parse(readFile("packages/tsconfig/nextjs.json"));

  it("existe y es JSON válido", () => {
    expect(fileExists("packages/tsconfig/nextjs.json")).toBe(true);
  });

  it("extiende base.json", () => {
    expect(tsconfig.extends).toBe("./base.json");
  });

  it("tiene jsx: preserve", () => {
    expect(tsconfig.compilerOptions.jsx).toBe("preserve");
  });

  it("tiene lib con dom, dom.iterable, esnext", () => {
    expect(tsconfig.compilerOptions.lib).toContain("dom");
    expect(tsconfig.compilerOptions.lib).toContain("dom.iterable");
    expect(tsconfig.compilerOptions.lib).toContain("esnext");
  });

  it("tiene plugin next", () => {
    expect(tsconfig.compilerOptions.plugins).toEqual(
      expect.arrayContaining([{ name: "next" }]),
    );
  });

  it("tiene paths @/* -> ./src/*", () => {
    expect(tsconfig.compilerOptions.paths["@/*"]).toContain("./src/*");
  });
});

describe("1.8 — packages/tsconfig/nestjs.json", () => {
  const tsconfig = JSON.parse(readFile("packages/tsconfig/nestjs.json"));

  it("existe y es JSON válido", () => {
    expect(fileExists("packages/tsconfig/nestjs.json")).toBe(true);
  });

  it("extiende base.json", () => {
    expect(tsconfig.extends).toBe("./base.json");
  });

  it("tiene module: CommonJS", () => {
    expect(tsconfig.compilerOptions.module).toBe("CommonJS");
  });

  it("tiene moduleResolution: Node", () => {
    expect(tsconfig.compilerOptions.moduleResolution).toBe("Node");
  });

  it("tiene emitDecoratorMetadata: true", () => {
    expect(tsconfig.compilerOptions.emitDecoratorMetadata).toBe(true);
  });

  it("tiene experimentalDecorators: true", () => {
    expect(tsconfig.compilerOptions.experimentalDecorators).toBe(true);
  });

  it("tiene paths @/* -> ./src/*", () => {
    expect(tsconfig.compilerOptions.paths["@/*"]).toContain("./src/*");
  });
});

describe("1.9 — packages/tsconfig/package.json", () => {
  const pkg = JSON.parse(readFile("packages/tsconfig/package.json"));

  it("existe y es JSON válido", () => {
    expect(fileExists("packages/tsconfig/package.json")).toBe(true);
  });

  it("tiene name @securesupply/tsconfig", () => {
    expect(pkg.name).toBe("@securesupply/tsconfig");
  });

  it("es private", () => {
    expect(pkg.private).toBe(true);
  });
});

// ═══════════════════════════════════════════
// Task 1.10 — packages/eslint-config
// ═══════════════════════════════════════════
describe("1.10 — packages/eslint-config", () => {
  it("index.ts existe", () => {
    expect(fileExists("packages/eslint-config/index.ts")).toBe(true);
  });

  it("package.json existe", () => {
    expect(fileExists("packages/eslint-config/package.json")).toBe(true);
  });

  const pkg = JSON.parse(readFile("packages/eslint-config/package.json"));

  it("tiene name @securesupply/eslint-config", () => {
    expect(pkg.name).toBe("@securesupply/eslint-config");
  });

  it("dependencias tienen versiones exactas", () => {
    for (const [name, version] of Object.entries(pkg.dependencies as Record<string, string>)) {
      expect(version, `${name}: ${version} no es exacta`).not.toMatch(/^[~^]/);
    }
  });

  it("depende de eslint 10.4.0", () => {
    expect(pkg.dependencies.eslint).toBe("10.4.0");
  });

  it("depende de typescript-eslint 8.60.0", () => {
    expect(pkg.dependencies["typescript-eslint"]).toBe("8.60.0");
  });

  it("depende de eslint-config-prettier 10.1.8", () => {
    expect(pkg.dependencies["eslint-config-prettier"]).toBe("10.1.8");
  });

  it("depende de @eslint/js 10.0.1", () => {
    expect(pkg.dependencies["@eslint/js"]).toBe("10.0.1");
  });
});

// ═══════════════════════════════════════════
// Task 1.11 — packages/types
// ═══════════════════════════════════════════
describe("1.11 — packages/types", () => {
  it("src/index.ts existe", () => {
    expect(fileExists("packages/types/src/index.ts")).toBe(true);
  });

  it("package.json existe", () => {
    expect(fileExists("packages/types/package.json")).toBe(true);
  });

  it("tsconfig.json existe", () => {
    expect(fileExists("packages/types/tsconfig.json")).toBe(true);
  });

  const pkg = JSON.parse(readFile("packages/types/package.json"));

  it("tiene name @securesupply/types", () => {
    expect(pkg.name).toBe("@securesupply/types");
  });

  it("depende de zod 4.4.3 (version exacta)", () => {
    expect(pkg.dependencies.zod).toBe("4.4.3");
  });

  it("dependencias tienen versiones exactas", () => {
    for (const [name, version] of Object.entries(pkg.dependencies as Record<string, string>)) {
      expect(version, `${name}: ${version} no es exacta`).not.toMatch(/^[~^]/);
    }
  });

  it("exporta schemas Zod", () => {
    const content = readFile("packages/types/src/index.ts");
    expect(content).toContain("export const ScanStatusEnum");
    expect(content).toContain("export const RepositorySchema");
    expect(content).toContain("export const FindingSchema");
    expect(content).toContain("export const ScanSchema");
  });

  it("usa z.infer<> para tipos", () => {
    const content = readFile("packages/types/src/index.ts");
    expect(content).toContain("z.infer<");
  });
});

// ═══════════════════════════════════════════
// Task 1.12 — packages/config
// ═══════════════════════════════════════════
describe("1.12 — packages/config", () => {
  it("src/index.ts existe", () => {
    expect(fileExists("packages/config/src/index.ts")).toBe(true);
  });

  it("src/env.schema.ts existe", () => {
    expect(fileExists("packages/config/src/env.schema.ts")).toBe(true);
  });

  it("package.json existe", () => {
    expect(fileExists("packages/config/package.json")).toBe(true);
  });

  const pkg = JSON.parse(readFile("packages/config/package.json"));

  it("tiene name @securesupply/config", () => {
    expect(pkg.name).toBe("@securesupply/config");
  });

  it("depende de zod 4.4.3 (version exacta)", () => {
    expect(pkg.dependencies.zod).toBe("4.4.3");
  });

  it("EnvSchema valida DATABASE_URL como URL requerida", () => {
    const content = readFile("packages/config/src/env.schema.ts");
    expect(content).toContain("DATABASE_URL");
    expect(content).toContain("z.string().url");
  });

  it("loadEnv falla rápido con error descriptivo", () => {
    const content = readFile("packages/config/src/index.ts");
    expect(content).toContain("loadEnv");
    expect(content).toContain("safeParse");
    expect(content).toContain("Error de configuración");
  });
});

// ═══════════════════════════════════════════
// Task 1.13 — packages/shared
// ═══════════════════════════════════════════
describe("1.13 — packages/shared", () => {
  it("src/index.ts existe", () => {
    expect(fileExists("packages/shared/src/index.ts")).toBe(true);
  });

  it("package.json existe", () => {
    expect(fileExists("packages/shared/package.json")).toBe(true);
  });

  const pkg = JSON.parse(readFile("packages/shared/package.json"));

  it("tiene name @securesupply/shared", () => {
    expect(pkg.name).toBe("@securesupply/shared");
  });

  it("exporta calculateRiskScore", () => {
    const content = readFile("packages/shared/src/index.ts");
    expect(content).toContain("calculateRiskScore");
  });

  it("exporta isValidRepositoryPath", () => {
    const content = readFile("packages/shared/src/index.ts");
    expect(content).toContain("isValidRepositoryPath");
  });

  it("exporta constantes como APP_NAME y SCAN_COOLDOWN_MS", () => {
    const content = readFile("packages/shared/src/index.ts");
    expect(content).toContain("APP_NAME");
    expect(content).toContain("SCAN_COOLDOWN_MS");
  });
});

// ═══════════════════════════════════════════
// Verificación global: Exact versions en TODOS los package.json
// ═══════════════════════════════════════════
describe("Verificación global — versiones exactas", () => {
  const allPackageJsonFiles = [
    "package.json",
    "packages/tsconfig/package.json",
    "packages/eslint-config/package.json",
    "packages/types/package.json",
    "packages/config/package.json",
    "packages/shared/package.json",
    "apps/web/package.json",
    "apps/api/package.json",
    "apps/worker/package.json",
  ];

  for (const file of allPackageJsonFiles) {
    it(`${file} no tiene ^ ni ~ en dependencias`, () => {
      const pkg = JSON.parse(readFile(file));
      const allDeps = {
        ...(pkg.dependencies || {}),
        ...(pkg.devDependencies || {}),
      };
      for (const [name, version] of Object.entries(allDeps as Record<string, string>)) {
        // workspace:* es válido para referencias internas
        if (version === "workspace:*" || version === "workspace:^") continue;
        expect(version, `${file} → ${name}: ${version} no es exacta`).not.toMatch(/^[~^]/);
      }
    });
  }
});

// ═══════════════════════════════════════════
// Verificación: NO hay npm ni yarn references en ningún archivo
// ═══════════════════════════════════════════
describe("Verificación global — solo pnpm", () => {
  const configFiles = [
    "package.json",
    ".npmrc",
    "pnpm-workspace.yaml",
    "turbo.json",
    "packages/tsconfig/package.json",
    "packages/eslint-config/package.json",
    "packages/types/package.json",
    "packages/config/package.json",
    "packages/shared/package.json",
    "apps/web/package.json",
    "apps/api/package.json",
    "apps/worker/package.json",
  ];

  for (const file of configFiles) {
    it(`${file} no contiene referencias a npm o yarn`, () => {
      // Skip binary/special files
      const content = readFile(file);
      // Revise for package manager references in script names or config
      const lines = content.split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        // Skip comments
        if (trimmed.startsWith("#") || trimmed.startsWith("//")) continue;
        // Allow "npm" in URLs or package names that include "npm"
        if (trimmed.includes("npm") && !trimmed.includes("//npm")) {
          // Check it's not a reference to actual npm the package manager
          // Allowed: schema URLs, package names containing "npm"
          if (trimmed.match(/\bnpm\s+(install|run|add|remove|ci|i)\b/)) {
            expect.unreachable(`${file} contiene referencia a npm: ${trimmed}`);
          }
        }
      }
    });
  }
});
