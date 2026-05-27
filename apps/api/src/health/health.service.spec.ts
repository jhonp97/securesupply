// ─────────────────────────────────────────────
// Tests unitarios — HealthService
// Cubre: checkDatabase, checkRedis, getQueueDepth,
//        getUptime
// TDD: RED → GREEN → REFACTOR
// ─────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks hoisted (se definen ANTES de vi.mock) ──
// Usamos vi.hoisted para que estén disponibles cuando
// vitest mueva vi.mock al tope del archivo
const mockPrisma = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
}));

const mockRedis = vi.hoisted(() => ({
  ping: vi.fn(),
}));

// Mock de dependencias para evitar cargar PrismaClient real
vi.mock("../database/prisma.service", () => ({
  PrismaService: vi.fn(() => mockPrisma),
}));

vi.mock("../redis/redis.service", () => ({
  RedisService: vi.fn(() => mockRedis),
}));

describe("HealthService", () => {
  let HealthService: any;
  let healthService: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    if (!HealthService) {
      const mod = await import("./health.service");
      HealthService = mod.HealthService;
    }
    healthService = new HealthService(mockPrisma as any, mockRedis as any);
  });

  // ═══════════════════════════════════════════════
  // checkDatabase()
  // ═══════════════════════════════════════════════
  describe("checkDatabase()", () => {
    it("debería retornar status 'ok' cuando SELECT 1 funciona", async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);

      const result = await healthService.checkDatabase();

      expect(result).toHaveProperty("status", "ok");
      expect(result).toHaveProperty("responseTimeMs");
      expect(typeof result.responseTimeMs).toBe("number");
      expect(result.responseTimeMs).toBeGreaterThanOrEqual(0);
      expect(mockPrisma.$queryRaw).toHaveBeenCalled();
    });

    it("debería retornar status 'fail' cuando SELECT 1 lanza error", async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error("DB connection failed"));

      const result = await healthService.checkDatabase();

      expect(result).toHaveProperty("status", "fail");
      expect(result).toHaveProperty("responseTimeMs");
      expect(typeof result.responseTimeMs).toBe("number");
    });

    it("debería medir el tiempo de respuesta en ms", async () => {
      mockPrisma.$queryRaw.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve([{ "?column?": 1 }]), 10),
          ),
      );

      const result = await healthService.checkDatabase();

      expect(result.responseTimeMs).toBeGreaterThanOrEqual(5);
    });
  });

  // ═══════════════════════════════════════════════
  // checkRedis()
  // ═══════════════════════════════════════════════
  describe("checkRedis()", () => {
    it("debería retornar status 'ok' cuando PING responde PONG", async () => {
      mockRedis.ping.mockResolvedValue(true);

      const result = await healthService.checkRedis();

      expect(result).toHaveProperty("status", "ok");
      expect(result).toHaveProperty("responseTimeMs");
      expect(typeof result.responseTimeMs).toBe("number");
      expect(mockRedis.ping).toHaveBeenCalled();
    });

    it("debería retornar status 'fail' cuando PING retorna false", async () => {
      mockRedis.ping.mockResolvedValue(false);

      const result = await healthService.checkRedis();

      expect(result).toHaveProperty("status", "fail");
      expect(result).toHaveProperty("responseTimeMs");
    });

    it("debería retornar status 'fail' cuando PING lanza error", async () => {
      mockRedis.ping.mockRejectedValue(new Error("Redis connection failed"));

      const result = await healthService.checkRedis();

      expect(result).toHaveProperty("status", "fail");
      expect(result).toHaveProperty("responseTimeMs");
    });

    it("debería medir el tiempo de respuesta en ms", async () => {
      mockRedis.ping.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(true), 10)),
      );

      const result = await healthService.checkRedis();

      expect(result.responseTimeMs).toBeGreaterThanOrEqual(5);
    });
  });

  // ═══════════════════════════════════════════════
  // getQueueDepth()
  // ═══════════════════════════════════════════════
  describe("getQueueDepth()", () => {
    it("debería retornar null como scaffold", () => {
      const result = healthService.getQueueDepth();

      expect(result).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════
  // getUptime()
  // ═══════════════════════════════════════════════
  describe("getUptime()", () => {
    it("debería retornar un número positivo", () => {
      const result = healthService.getUptime();

      expect(typeof result).toBe("number");
      expect(result).toBeGreaterThanOrEqual(0);
    });
  });
});
