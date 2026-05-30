// ─────────────────────────────────────────────
// Tests de integración — Auth + Health
// Usa testcontainers con PostgreSQL 17 + Redis 8
// Prueba los flujos completos contra BD y Redis reales
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

describeFn("Integración: Auth + Health (contenedores reales)", () => {
  let pgContainer: Awaited<ReturnType<PostgreSqlContainer["start"]>>;
  let redisContainer: Awaited<ReturnType<RedisContainer["start"]>>;
  let app: INestApplication;
  let originalEnv: Record<string, string | undefined>;

  beforeAll(async () => {
    // Guardar env original
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

    // Configurar env para las conexiones reales
    process.env["DATABASE_URL"] = pgUrl;
    process.env["REDIS_URL"] = redisUrl;
    process.env["JWT_SECRET"] = "test-jwt-secret-at-least-32-characters-long!!";
    process.env["REFRESH_TOKEN_SECRET"] =
      "test-refresh-secret-at-least-32-characters!!";
    process.env["NODE_ENV"] = "test";

    // ── Ejecutar migraciones en el contenedor ─
    const schemaPath = resolve(__dirname, "../../prisma/schema.prisma");
    execSync(
      `npx prisma db push --schema="${schemaPath}" --url="${pgUrl}" --accept-data-loss`,
      { stdio: "pipe", timeout: 30000 },
    );

    // ── Crear aplicación NestJS ───────────────
    // Usamos AppModule directamente para asegurar que todos los módulos
    // se compilen correctamente con sus dependencias
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();
  }, 120_000); // Timeout de 2 min para levantar containers

  afterAll(async () => {
    await app?.close();
    await pgContainer?.stop();
    await redisContainer?.stop();
    // Restaurar env original
    for (const key of Object.keys(originalEnv)) {
      if (originalEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalEnv[key];
      }
    }
  }, 30_000);

  // ═══════════════════════════════════════════════
  // Health Endpoints
  // ═══════════════════════════════════════════════
  describe("GET /health", () => {
    it("debería retornar 200 con db y redis conectados", async () => {
      const res = await request(app.getHttpServer())
        .get("/health")
        .expect(200);

      expect(res.body).toHaveProperty("status", "ok");
      expect(res.body).toHaveProperty("db");
      expect(res.body.db).toHaveProperty("status", "ok");
      expect(res.body.db).toHaveProperty("responseTimeMs");
      expect(typeof res.body.db.responseTimeMs).toBe("number");
      expect(res.body).toHaveProperty("redis");
      expect(res.body.redis).toHaveProperty("status", "ok");
      expect(res.body.redis).toHaveProperty("responseTimeMs");
      expect(typeof res.body.redis.responseTimeMs).toBe("number");
      expect(res.body).toHaveProperty("version");
      expect(res.body).toHaveProperty("uptime");
      expect(typeof res.body.uptime).toBe("number");
    });
  });

  describe("GET /health/ready", () => {
    it("debería retornar 200 con ready=true cuando los servicios están saludables", async () => {
      const res = await request(app.getHttpServer())
        .get("/health/ready")
        .expect(200);

      expect(res.body).toHaveProperty("ready", true);
    });
  });

  // ═══════════════════════════════════════════════
  // Auth: Register
  // ═══════════════════════════════════════════════
  describe("POST /auth/register", () => {
    const testUser = {
      email: `register-test-${Date.now()}@example.com`,
      password: "SecurePass123!",
    };

    it("debería crear un usuario y retornar 201", async () => {
      const res = await request(app.getHttpServer())
        .post("/auth/register")
        .send(testUser)
        .expect(201);

      expect(res.body).toHaveProperty(
        "message",
        "Usuario registrado exitosamente",
      );
    });

    it("debería rechazar email duplicado con 409", async () => {
      await request(app.getHttpServer())
        .post("/auth/register")
        .send(testUser)
        .expect(409);
    });

    it("debería rechazar datos inválidos con 400", async () => {
      await request(app.getHttpServer())
        .post("/auth/register")
        .send({ email: "invalido", password: "12" })
        .expect(400);
    });
  });

  // ═══════════════════════════════════════════════
  // Auth: Login
  // ═══════════════════════════════════════════════
  describe("POST /auth/login", () => {
    const loginUser = {
      email: `login-test-${Date.now()}@example.com`,
      password: "MyPassword123!",
    };

    beforeAll(async () => {
      await request(app.getHttpServer())
        .post("/auth/register")
        .send(loginUser);
    });

    it("debería retornar 200 con accessToken y cookie", async () => {
      const res = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email: loginUser.email, password: loginUser.password })
        .expect(200);

      expect(res.body).toHaveProperty("accessToken");
      expect(typeof res.body.accessToken).toBe("string");

      // Verificar cookie httpOnly
      const cookies = res.headers["set-cookie"];
      expect(cookies).toBeDefined();
      const cookiesArr = Array.isArray(cookies) ? cookies : [cookies];
      const refreshCookie = cookiesArr.find(
        (c: string) => c.startsWith("refresh_token="),
      );
      expect(refreshCookie).toBeDefined();
      expect(refreshCookie).toContain("HttpOnly");
      expect(refreshCookie).toContain("SameSite=Strict");
    });

    it("debería retornar 401 con password incorrecto", async () => {
      const res = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email: loginUser.email, password: "wrong-password!" })
        .expect(401);

      expect(res.body).toHaveProperty("message");
    });

    it("debería retornar 401 con email inexistente (mismo mensaje genérico)", async () => {
      const res = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email: "noexiste@example.com", password: "anything" })
        .expect(401);

      expect(res.body).toHaveProperty("message");
    });
  });

  // ═══════════════════════════════════════════════
  // Auth: Refresh
  // ═══════════════════════════════════════════════
  describe("POST /auth/refresh", () => {
    const refreshUser = {
      email: `refresh-test-${Date.now()}@example.com`,
      password: "RefreshPass123!",
    };
    let refreshTokenCookie: string;

    beforeAll(async () => {
      await request(app.getHttpServer())
        .post("/auth/register")
        .send(refreshUser);

      const loginRes = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email: refreshUser.email, password: refreshUser.password });

      const cookies = loginRes.headers["set-cookie"];
      expect(cookies).toBeDefined();
      const cookiesArr = Array.isArray(cookies) ? cookies : [cookies];
      const cookie = cookiesArr.find((c: string) =>
        c.startsWith("refresh_token="),
      );
      expect(cookie).toBeDefined();
      refreshTokenCookie = cookie!.split(";")[0]!;
    });

    it("debería retornar 200 con nuevo accessToken al refrescar", async () => {
      const res = await request(app.getHttpServer())
        .post("/auth/refresh")
        .set("Cookie", refreshTokenCookie)
        .expect(200);

      expect(res.body).toHaveProperty("accessToken");
      expect(typeof res.body.accessToken).toBe("string");
    });
  });

  // ═══════════════════════════════════════════════
  // Auth: Logout
  // ═══════════════════════════════════════════════
  describe("DELETE /auth/logout", () => {
    const logoutUser = {
      email: `logout-test-${Date.now()}@example.com`,
      password: "LogoutPass123!",
    };
    let refreshTokenCookie: string;

    beforeAll(async () => {
      await request(app.getHttpServer())
        .post("/auth/register")
        .send(logoutUser);

      const loginRes = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ email: logoutUser.email, password: logoutUser.password });

      const cookies = loginRes.headers["set-cookie"];
      const cookiesArr = Array.isArray(cookies) ? cookies : [cookies];
      const cookie = cookiesArr.find((c: string) =>
        c.startsWith("refresh_token="),
      );
      refreshTokenCookie = cookie!.split(";")[0]!;
    });

    it("debería retornar 200 al cerrar sesión", async () => {
      await request(app.getHttpServer())
        .delete("/auth/logout")
        .set("Cookie", refreshTokenCookie)
        .expect(200);
    });
  });
}, 180_000);
