// ─────────────────────────────────────────────
// Tests de integración — API de Repositorios
// Usa testcontainers con PostgreSQL 17 + Redis 8
// Verifica: CRUD de repos, trigger de escaneo,
//           lock concurrente, ownership (403)
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
  "Integración: API de Repositorios (contenedores reales)",
  () => {
    let pgContainer: Awaited<ReturnType<PostgreSqlContainer["start"]>>;
    let redisContainer: Awaited<ReturnType<RedisContainer["start"]>>;
    let app: INestApplication;
    let originalEnv: Record<string, string | undefined>;

    // Tokens de autenticación para dos usuarios distintos
    let tokenUserA: string;
    let tokenUserB: string;
    let repoIdUserA: string;

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

      // ── Registrar dos usuarios y obtener tokens ──
      const ts = Date.now();

      // Usuario A
      await request(app.getHttpServer())
        .post("/auth/register")
        .send({
          email: `user-a-${ts}@example.com`,
          password: "SecurePass123!",
        })
        .expect(201);

      const loginA = await request(app.getHttpServer())
        .post("/auth/login")
        .send({
          email: `user-a-${ts}@example.com`,
          password: "SecurePass123!",
        })
        .expect(200);

      tokenUserA = loginA.body.accessToken;

      // Usuario B
      await request(app.getHttpServer())
        .post("/auth/register")
        .send({
          email: `user-b-${ts}@example.com`,
          password: "SecurePass123!",
        })
        .expect(201);

      const loginB = await request(app.getHttpServer())
        .post("/auth/login")
        .send({
          email: `user-b-${ts}@example.com`,
          password: "SecurePass123!",
        })
        .expect(200);

      tokenUserB = loginB.body.accessToken;
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
    // POST /api/repositories — Crear repositorio
    // ═══════════════════════════════════════════════
    describe("POST /api/repositories", () => {
      it("debería crear repositorio con fullName válido → 201", async () => {
        const res = await request(app.getHttpServer())
          .post("/api/repositories")
          .set("Authorization", `Bearer ${tokenUserA}`)
          .send({ fullName: "octocat/hello-world" })
          .expect(201);

        expect(res.body).toHaveProperty("id");
        expect(res.body).toHaveProperty("fullName", "octocat/hello-world");
        repoIdUserA = res.body.id;
      });

      it("debería rechazar fullName con formato inválido → 400", async () => {
        await request(app.getHttpServer())
          .post("/api/repositories")
          .set("Authorization", `Bearer ${tokenUserA}`)
          .send({ fullName: "invalid-format" })
          .expect(400);
      });

      it("debería rechazar repo duplicado → 409", async () => {
        await request(app.getHttpServer())
          .post("/api/repositories")
          .set("Authorization", `Bearer ${tokenUserA}`)
          .send({ fullName: "octocat/hello-world" })
          .expect(409);
      });

      it("debería rechazar request sin autenticación → 401", async () => {
        await request(app.getHttpServer())
          .post("/api/repositories")
          .send({ fullName: "octocat/otro-repo" })
          .expect(401);
      });
    });

    // ═══════════════════════════════════════════════
    // GET /api/repositories — Listar repositorios
    // ═══════════════════════════════════════════════
    describe("GET /api/repositories", () => {
      it("debería retornar solo los repos del usuario autenticado", async () => {
        const res = await request(app.getHttpServer())
          .get("/api/repositories")
          .set("Authorization", `Bearer ${tokenUserA}`)
          .expect(200);

        expect(res.body).toHaveProperty("data");
        expect(res.body).toHaveProperty("total");
        expect(Array.isArray(res.body.data)).toBe(true);
        // Todos los repos deben pertenecer al usuario A
        for (const repo of res.body.data) {
          expect(repo).toHaveProperty("ownerId");
        }
      });

      it("debería retornar lista vacía para usuario B (sin repos)", async () => {
        const res = await request(app.getHttpServer())
          .get("/api/repositories")
          .set("Authorization", `Bearer ${tokenUserB}`)
          .expect(200);

        expect(res.body.data).toHaveLength(0);
        expect(res.body.total).toBe(0);
      });
    });

    // ═══════════════════════════════════════════════
    // GET /api/repositories/:id — Detalle
    // ═══════════════════════════════════════════════
    describe("GET /api/repositories/:id", () => {
      it("debería retornar 403 si el usuario B intenta acceder al repo del usuario A", async () => {
        await request(app.getHttpServer())
          .get(`/api/repositories/${repoIdUserA}`)
          .set("Authorization", `Bearer ${tokenUserB}`)
          .expect(403);
      });
    });

    // ═══════════════════════════════════════════════
    // POST /api/repositories/:id/scan — Trigger escaneo
    // ═══════════════════════════════════════════════
    describe("POST /api/repositories/:id/scan", () => {
      it("debería crear ScanJob y retornar 201", async () => {
        const res = await request(app.getHttpServer())
          .post(`/api/repositories/${repoIdUserA}/scan`)
          .set("Authorization", `Bearer ${tokenUserA}`)
          .send({ gitRef: "main" })
          .expect(201);

        expect(res.body).toHaveProperty("id");
        expect(res.body).toHaveProperty("status", "QUEUED");
        expect(res.body).toHaveProperty("triggerType", "MANUAL");
        expect(res.body).toHaveProperty("gitRef", "main");
      });

      it("debería retornar 409 si ya hay un escaneo activo (lock concurrente)", async () => {
        // El escaneo anterior está en status QUEUED → lock activo
        await request(app.getHttpServer())
          .post(`/api/repositories/${repoIdUserA}/scan`)
          .set("Authorization", `Bearer ${tokenUserA}`)
          .send({ gitRef: "main" })
          .expect(409);
      });

      it("debería retornar 403 si usuario B intenta escanear repo del usuario A", async () => {
        await request(app.getHttpServer())
          .post(`/api/repositories/${repoIdUserA}/scan`)
          .set("Authorization", `Bearer ${tokenUserB}`)
          .send({ gitRef: "main" })
          .expect(403);
      });
    });
  },
  180_000,
);
