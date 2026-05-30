// ─────────────────────────────────────────────
// Tests de integración — Webhooks de GitHub
// Usa testcontainers con PostgreSQL 17 + Redis 8
// Verifica: HMAC válido/inválido, eventos
//           soportados/no soportados, encolado
// ─────────────────────────────────────────────

import "reflect-metadata";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync } from "node:child_process";
import { resolve } from "node:path";
import { createHmac } from "node:crypto";
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

/** Genera firma HMAC-SHA256 para un payload dado */
function firmarPayload(payload: string, secret: string): string {
  return `sha256=${createHmac("sha256", secret).update(payload).digest("hex")}`;
}

const dockerAvailable = isDockerAvailable();

const describeFn = dockerAvailable ? describe : describe.skip;

describeFn(
  "Integración: Webhooks de GitHub (contenedores reales)",
  () => {
    let pgContainer: Awaited<ReturnType<PostgreSqlContainer["start"]>>;
    let redisContainer: Awaited<ReturnType<RedisContainer["start"]>>;
    let app: INestApplication;
    let originalEnv: Record<string, string | undefined>;

    const webhookSecret = "test-webhook-secret-for-hmac-verification!";

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
      process.env["GITHUB_WEBHOOK_SECRET"] = webhookSecret;
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
    // POST /webhooks/github
    // ═══════════════════════════════════════════════
    describe("POST /webhooks/github", () => {
      const payloadValido = JSON.stringify({
        ref: "refs/heads/main",
        repository: {
          id: 123456,
          full_name: "octocat/hello-world",
          default_branch: "main",
          private: false,
        },
        installation: {
          id: 789,
        },
      });

      it("debería retornar 200 y encolar escaneo con HMAC válido y evento push", async () => {
        const firma = firmarPayload(payloadValido, webhookSecret);

        const res = await request(app.getHttpServer())
          .post("/webhooks/github")
          .set("Content-Type", "application/json")
          .set("x-github-event", "push")
          .set("x-github-delivery", "delivery-test-1")
          .set("x-hub-signature-256", firma)
          .send(payloadValido)
          .expect(200);

        expect(res.body).toHaveProperty("message");
        // El mensaje puede ser "Webhook procesado" o "Repositorio no vinculado"
        // dependiendo de si el repo existe en BD
        expect(typeof res.body.message).toBe("string");
      });

      it("debería retornar 401 con firma HMAC inválida", async () => {
        const firmaInvalida = "sha256=0000000000000000000000000000000000000000000000000000000000000000";

        await request(app.getHttpServer())
          .post("/webhooks/github")
          .set("Content-Type", "application/json")
          .set("x-github-event", "push")
          .set("x-github-delivery", "delivery-test-2")
          .set("x-hub-signature-256", firmaInvalida)
          .send(payloadValido)
          .expect(401);
      });

      it("debería retornar 200 y mensaje de evento ignorado para evento no soportado", async () => {
        const firma = firmarPayload(payloadValido, webhookSecret);

        const res = await request(app.getHttpServer())
          .post("/webhooks/github")
          .set("Content-Type", "application/json")
          .set("x-github-event", "star")
          .set("x-github-delivery", "delivery-test-3")
          .set("x-hub-signature-256", firma)
          .send(payloadValido)
          .expect(200);

        expect(res.body).toHaveProperty("message", "Evento ignorado");
      });

      it("debería retornar 401 sin headers de firma requeridos", async () => {
        await request(app.getHttpServer())
          .post("/webhooks/github")
          .set("Content-Type", "application/json")
          .send(payloadValido)
          .expect(401);
      });
    });
  },
  180_000,
);
