// ─────────────────────────────────────────────
// Tests de integración — Lock de escaneo concurrente
// Usa testcontainers con PostgreSQL 17 + Redis 8
// Verifica: lock concurrente (409), desbloqueo
//           al completar escaneo (201)
// ─────────────────────────────────────────────

import "reflect-metadata";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync } from "node:child_process";
import { resolve } from "node:path";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { RedisContainer } from "@testcontainers/redis";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import { AppModule } from "../app.module";
import { PrismaService } from "../database/prisma.service";
import cookieParser from "cookie-parser";
import request from "supertest";

/**
 * Verifica si Docker está disponible antes de ejecutar tests.
 * Si no lo está, los tests se marcan como skip automáticamente.
 */
function isDockerAvailable(): boolean {
  try {
    execSync("docker info", { stdio: "pipe", timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

const dockerAvailable = isDockerAvailable();

const describeFn = dockerAvailable ? describe : describe.skip;

describeFn(
  "Integración: Lock de escaneo concurrente (contenedores reales)",
  () => {
    let pgContainer: Awaited<ReturnType<PostgreSqlContainer["start"]>>;
    let redisContainer: Awaited<ReturnType<RedisContainer["start"]>>;
    let app: INestApplication;
    let prisma: PrismaService;
    let originalEnv: Record<string, string | undefined>;

    let tokenUser: string;
    let repoId: string;

    beforeAll(async () => {
      originalEnv = { ...process.env };

      // ── Iniciar PostgreSQL 17 ─────────────────
      pgContainer = await new PostgreSqlContainer("postgres:17")
        .withDatabase("testdb")
        .withUsername("test")
        .withPassword("test")
        .withExposedPorts(5432)
        .start();

      const pgHost = pgContainer.getHost();
      const pgPort = pgContainer.getFirstMappedPort();
      const pgUrl = `postgresql://test:test@${pgHost}:${pgPort}/testdb`;

      // ── Iniciar Redis 8 ──────────────────────
      redisContainer = await new RedisContainer("redis:8")
        .withExposedPorts(6379)
        .start();

      const redisHost = redisContainer.getHost();
      const redisPort = redisContainer.getFirstMappedPort();
      const redisUrl = `redis://${redisHost}:${redisPort}`;

      // Configurar env
      process.env["DATABASE_URL"] = pgUrl;
      process.env["REDIS_URL"] = redisUrl;
      process.env["JWT_SECRET"] =
        "test-jwt-secret-at-least-32-characters-long!!";
      process.env["REFRESH_TOKEN_SECRET"] =
        "test-refresh-secret-at-least-32-characters!!";
      process.env["GITHUB_WEBHOOK_SECRET"] = "test-webhook-secret";
      process.env["GITHUB_APP_ID"] = "12345";
      process.env["GITHUB_APP_PRIVATE_KEY"] =
        originalEnv["GITHUB_APP_PRIVATE_KEY"] ?? "test-key";
      process.env["NODE_ENV"] = "test";

      // ── Ejecutar migraciones ──────────────────
      const schemaPath = resolve(__dirname, "../../prisma/schema.prisma");
      execSync(
        `npx prisma db push --schema="${schemaPath}" --url="${pgUrl}" --accept-data-loss`,
        { stdio: "pipe", timeout: 30000 },
      );

      // ── Crear aplicación NestJS ───────────────
      const moduleRef = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

      app = moduleRef.createNestApplication({ rawBody: true });
      app.use(cookieParser());
      app.setGlobalPrefix("api", {
        exclude: [
          { path: "health", method: "GET" as any },
          { path: "webhooks/github", method: "POST" as any },
        ],
      });
      await app.init();

      // Obtener PrismaService para manipular BD directamente
      prisma = moduleRef.get(PrismaService);

      // ── Registrar usuario y crear repo ────────
      const ts = Date.now();

      await request(app.getHttpServer())
        .post("/auth/register")
        .send({
          email: `scanlock-user-${ts}@example.com`,
          password: "SecurePass123!",
        })
        .expect(201);

      const loginRes = await request(app.getHttpServer())
        .post("/auth/login")
        .send({
          email: `scanlock-user-${ts}@example.com`,
          password: "SecurePass123!",
        })
        .expect(200);

      tokenUser = loginRes.body.accessToken;

      // Crear repositorio para las pruebas de lock
      const repoRes = await request(app.getHttpServer())
        .post("/api/repositories")
        .set("Authorization", `Bearer ${tokenUser}`)
        .send({ fullName: "octocat/scan-lock-test" })
        .expect(201);

      repoId = repoRes.body.id;
    }, 120_000);

    afterAll(async () => {
      await app?.close();
      await pgContainer?.stop();
      await redisContainer?.stop();
      for (const key of Object.keys(originalEnv)) {
        if (originalEnv[key] === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = originalEnv[key];
        }
      }
    }, 30_000);

    // ═══════════════════════════════════════════════
    // Lock concurrente — 409 en segundo trigger
    // ═══════════════════════════════════════════════
    describe("Lock de escaneo concurrente", () => {
      it("debería crear el primer escaneo → 201", async () => {
        const res = await request(app.getHttpServer())
          .post(`/api/repositories/${repoId}/scan`)
          .set("Authorization", `Bearer ${tokenUser}`)
          .send({ gitRef: "main" })
          .expect(201);

        expect(res.body).toHaveProperty("status", "QUEUED");
      });

      it("debería rechazar segundo escaneo con 409 (lock activo)", async () => {
        const res = await request(app.getHttpServer())
          .post(`/api/repositories/${repoId}/scan`)
          .set("Authorization", `Bearer ${tokenUser}`)
          .send({ gitRef: "main" })
          .expect(409);

        expect(res.body).toHaveProperty("message");
        expect(res.body.message).toContain("escaneo activo");
      });

      it("debería permitir nuevo escaneo después de completar el anterior", async () => {
        // Simular completado del escaneo actualizando status en BD
        await prisma.scanJob.updateMany({
          where: { repositoryId: repoId, status: "QUEUED" },
          data: { status: "COMPLETED" },
        });

        // Ahora debería permitir un nuevo escaneo
        const res = await request(app.getHttpServer())
          .post(`/api/repositories/${repoId}/scan`)
          .set("Authorization", `Bearer ${tokenUser}`)
          .send({ gitRef: "develop" })
          .expect(201);

        expect(res.body).toHaveProperty("status", "QUEUED");
        expect(res.body).toHaveProperty("gitRef", "develop");
      });

      it("debería bloquear escaneo si hay uno en status CLONING", async () => {
        // Poner el último scan en CLONING
        await prisma.scanJob.updateMany({
          where: { repositoryId: repoId, status: "QUEUED" },
          data: { status: "CLONING" },
        });

        await request(app.getHttpServer())
          .post(`/api/repositories/${repoId}/scan`)
          .set("Authorization", `Bearer ${tokenUser}`)
          .send({ gitRef: "main" })
          .expect(409);
      });

      it("debería bloquear escaneo si hay uno en status SCANNING", async () => {
        // Poner el último scan en SCANNING
        await prisma.scanJob.updateMany({
          where: { repositoryId: repoId, status: "CLONING" },
          data: { status: "SCANNING" },
        });

        await request(app.getHttpServer())
          .post(`/api/repositories/${repoId}/scan`)
          .set("Authorization", `Bearer ${tokenUser}`)
          .send({ gitRef: "main" })
          .expect(409);
      });

      it("debería permitir escaneo después de FAILED (no bloquea)", async () => {
        // Poner el último scan en FAILED
        await prisma.scanJob.updateMany({
          where: { repositoryId: repoId, status: "SCANNING" },
          data: { status: "FAILED" },
        });

        const res = await request(app.getHttpServer())
          .post(`/api/repositories/${repoId}/scan`)
          .set("Authorization", `Bearer ${tokenUser}`)
          .send({ gitRef: "main" })
          .expect(201);

        expect(res.body).toHaveProperty("status", "QUEUED");
      });
    });
  },
  180_000,
);
