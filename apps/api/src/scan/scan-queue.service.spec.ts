// ─────────────────────────────────────────────
// Tests unitarios — ScanQueueService
// Cubre: enqueueScan (lock concurrente, creación
//        de ScanJob, encolado en BullMQ, cache Redis)
//        getQueueStatus (métricas de cola)
// TDD: RED → GREEN → REFACTOR
// ─────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConflictException } from "@nestjs/common";

// ── Mocks ──
const mockPrisma = {
  $transaction: vi.fn(),
  scanJob: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
};

const mockScanQueue = {
  add: vi.fn(),
  getWaitingCount: vi.fn(),
  getActiveCount: vi.fn(),
  getCompletedCount: vi.fn(),
};

const mockRedisService = {
  getClient: vi.fn(() => ({
    set: vi.fn(),
  })),
};

describe("ScanQueueService", () => {
  let ScanQueueService: any;
  let service: any;

  const repositoryId = "repo-123";
  const triggerType = "MANUAL" as const;
  const gitRef = "main";

  beforeEach(async () => {
    vi.clearAllMocks();

    if (!ScanQueueService) {
      const mod = await import("./scan-queue.service");
      ScanQueueService = mod.ScanQueueService;
    }

    service = new ScanQueueService(
      mockPrisma as any,
      mockScanQueue as any,
      mockRedisService as any,
    );
  });

  // ═══════════════════════════════════════════════
  // enqueueScan()
  // ═══════════════════════════════════════════════
  describe("enqueueScan()", () => {
    it("debería crear ScanJob y encolar en BullMQ cuando no hay lock", async () => {
      // Simular transacción: verificar lock + crear ScanJob
      mockPrisma.$transaction.mockImplementation(async (callback: any) => {
        return callback(mockPrisma);
      });

      // No hay escaneo activo
      mockPrisma.scanJob.findFirst.mockResolvedValue(null);

      // Crear ScanJob
      const mockScanJob = {
        id: "scan-job-1",
        repositoryId,
        status: "QUEUED",
        triggerType,
        gitRef,
      };
      mockPrisma.scanJob.create.mockResolvedValue(mockScanJob);

      // Encolar en BullMQ
      mockScanQueue.add.mockResolvedValue({ id: "bull-job-1" });

      const result = await service.enqueueScan(
        repositoryId,
        triggerType,
        gitRef,
      );

      expect(result).toHaveProperty("scanJobId", "scan-job-1");
      expect(mockPrisma.scanJob.findFirst).toHaveBeenCalledWith({
        where: {
          repositoryId,
          status: { in: ["QUEUED", "CLONING", "SCANNING"] },
        },
      });
      expect(mockPrisma.scanJob.create).toHaveBeenCalledWith({
        data: {
          repositoryId,
          triggerType,
          gitRef,
          status: "QUEUED",
        },
      });
      expect(mockScanQueue.add).toHaveBeenCalledWith(
        "scan",
        expect.objectContaining({
          scanJobId: "scan-job-1",
          repositoryId,
          gitRef,
        }),
      );
    });

    it("debería lanzar ConflictException si hay escaneo QUEUED activo", async () => {
      mockPrisma.$transaction.mockImplementation(async (callback: any) => {
        return callback(mockPrisma);
      });

      mockPrisma.scanJob.findFirst.mockResolvedValue({
        id: "scan-active",
        status: "QUEUED",
      });

      await expect(
        service.enqueueScan(repositoryId, triggerType, gitRef),
      ).rejects.toThrow(ConflictException);

      expect(mockPrisma.scanJob.create).not.toHaveBeenCalled();
      expect(mockScanQueue.add).not.toHaveBeenCalled();
    });

    it("debería lanzar ConflictException si hay escaneo CLONING activo", async () => {
      mockPrisma.$transaction.mockImplementation(async (callback: any) => {
        return callback(mockPrisma);
      });

      mockPrisma.scanJob.findFirst.mockResolvedValue({
        id: "scan-cloning",
        status: "CLONING",
      });

      await expect(
        service.enqueueScan(repositoryId, triggerType, gitRef),
      ).rejects.toThrow(ConflictException);
    });

    it("debería lanzar ConflictException si hay escaneo SCANNING activo", async () => {
      mockPrisma.$transaction.mockImplementation(async (callback: any) => {
        return callback(mockPrisma);
      });

      mockPrisma.scanJob.findFirst.mockResolvedValue({
        id: "scan-scanning",
        status: "SCANNING",
      });

      await expect(
        service.enqueueScan(repositoryId, triggerType, gitRef),
      ).rejects.toThrow(ConflictException);
    });

    it("debería actualizar cache Redis con status del ScanJob (best-effort)", async () => {
      mockPrisma.$transaction.mockImplementation(async (callback: any) => {
        return callback(mockPrisma);
      });

      mockPrisma.scanJob.findFirst.mockResolvedValue(null);
      mockPrisma.scanJob.create.mockResolvedValue({
        id: "scan-job-2",
        repositoryId,
        status: "QUEUED",
      });
      mockScanQueue.add.mockResolvedValue({ id: "bull-job-2" });

      const mockRedisClient = {
        set: vi.fn().mockResolvedValue("OK"),
      };
      mockRedisService.getClient.mockReturnValue(mockRedisClient);

      await service.enqueueScan(repositoryId, triggerType, gitRef);

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        "scan:scan-job-2:status",
        "QUEUED",
      );
    });

    it("debería continuar aunque Redis falle (best-effort)", async () => {
      mockPrisma.$transaction.mockImplementation(async (callback: any) => {
        return callback(mockPrisma);
      });

      mockPrisma.scanJob.findFirst.mockResolvedValue(null);
      mockPrisma.scanJob.create.mockResolvedValue({
        id: "scan-job-3",
        repositoryId,
        status: "QUEUED",
      });
      mockScanQueue.add.mockResolvedValue({ id: "bull-job-3" });

      // Redis falla
      const mockRedisClient = {
        set: vi.fn().mockRejectedValue(new Error("Redis connection failed")),
      };
      mockRedisService.getClient.mockReturnValue(mockRedisClient);

      // No debería lanzar excepción
      const result = await service.enqueueScan(
        repositoryId,
        triggerType,
        gitRef,
      );

      expect(result).toHaveProperty("scanJobId", "scan-job-3");
    });

    it("debería usar transacción Prisma para atomicidad (lock + create)", async () => {
      mockPrisma.$transaction.mockImplementation(async (callback: any) => {
        return callback(mockPrisma);
      });

      mockPrisma.scanJob.findFirst.mockResolvedValue(null);
      mockPrisma.scanJob.create.mockResolvedValue({
        id: "scan-job-4",
        repositoryId,
        status: "QUEUED",
      });
      mockScanQueue.add.mockResolvedValue({ id: "bull-job-4" });

      await service.enqueueScan(repositoryId, triggerType, gitRef);

      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════
  // getQueueStatus()
  // ═══════════════════════════════════════════════
  describe("getQueueStatus()", () => {
    it("debería retornar métricas de la cola (waiting, active, completed)", async () => {
      mockScanQueue.getWaitingCount.mockResolvedValue(5);
      mockScanQueue.getActiveCount.mockResolvedValue(2);
      mockScanQueue.getCompletedCount.mockResolvedValue(100);

      const result = await service.getQueueStatus();

      expect(result).toEqual({
        waiting: 5,
        active: 2,
        completed: 100,
      });
    });

    it("debería retornar ceros cuando la cola está vacía", async () => {
      mockScanQueue.getWaitingCount.mockResolvedValue(0);
      mockScanQueue.getActiveCount.mockResolvedValue(0);
      mockScanQueue.getCompletedCount.mockResolvedValue(0);

      const result = await service.getQueueStatus();

      expect(result).toEqual({
        waiting: 0,
        active: 0,
        completed: 0,
      });
    });
  });
});
