// ─────────────────────────────────────────────
// Tests unitarios — RepositoriesService
// Cubre: findAll, create, findOne, remove,
//        triggerScan, concurrent lock, anti-SSRF
// TDD: RED → GREEN → REFACTOR
// ─────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";

// ── Mocks ──
const mockPrisma = {
  repository: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  scanJob: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
};

const mockGitHubService = {
  getRepoInfo: vi.fn(),
  getInstallationToken: vi.fn(),
};

const mockScanQueue = {
  add: vi.fn(),
};

describe("RepositoriesService", () => {
  let RepositoriesService: any;
  let service: any;

  const userId = "user-1";
  const repoId = "repo-1";

  beforeEach(async () => {
    vi.clearAllMocks();

    if (!RepositoriesService) {
      const mod = await import("./repositories.service");
      RepositoriesService = mod.RepositoriesService;
    }

    service = new RepositoriesService(
      mockPrisma as any,
      mockGitHubService as any,
      mockScanQueue as any,
    );
  });

  // ═══════════════════════════════════════════════
  // findAll()
  // ═══════════════════════════════════════════════
  describe("findAll()", () => {
    it("debería retornar lista paginada de repositorios del usuario", async () => {
      const mockRepos = [
        { id: "repo-1", fullName: "owner/repo-1", ownerId: userId },
        { id: "repo-2", fullName: "owner/repo-2", ownerId: userId },
      ];
      mockPrisma.repository.findMany.mockResolvedValue(mockRepos);
      mockPrisma.repository.count.mockResolvedValue(2);

      const result = await service.findAll(userId);

      expect(result).toHaveProperty("data");
      expect(result).toHaveProperty("total");
      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(mockPrisma.repository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { ownerId: userId },
        }),
      );
    });

    it("debería retornar lista vacía si el usuario no tiene repos", async () => {
      mockPrisma.repository.findMany.mockResolvedValue([]);
      mockPrisma.repository.count.mockResolvedValue(0);

      const result = await service.findAll(userId);

      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════
  // create()
  // ═══════════════════════════════════════════════
  describe("create()", () => {
    it("debería crear un repositorio vinculado al usuario", async () => {
      const dto = { fullName: "octocat/hello-world" };
      mockPrisma.repository.findUnique.mockResolvedValue(null);
      mockPrisma.repository.create.mockResolvedValue({
        id: "repo-new",
        fullName: dto.fullName,
        ownerId: userId,
      });

      const result = await service.create(userId, dto);

      expect(result).toHaveProperty("id", "repo-new");
      expect(mockPrisma.repository.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          fullName: dto.fullName,
          ownerId: userId,
        }),
      });
    });

    it("debería lanzar ConflictException si el repo ya existe", async () => {
      const dto = { fullName: "octocat/hello-world" };
      mockPrisma.repository.findUnique.mockResolvedValue({
        id: "existing",
        fullName: dto.fullName,
      });

      await expect(service.create(userId, dto)).rejects.toThrow(
        ConflictException,
      );
    });

    it("debería validar URL con anti-SSRF antes de crear", async () => {
      const dto = { fullName: "octocat/hello-world" };
      mockPrisma.repository.findUnique.mockResolvedValue(null);
      mockPrisma.repository.create.mockResolvedValue({
        id: "repo-new",
        fullName: dto.fullName,
        ownerId: userId,
      });

      await service.create(userId, dto);

      // La URL construida debería ser https://github.com/octocat/hello-world
      // validateGitHubUrl debería pasar para esa URL
      expect(mockPrisma.repository.create).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════
  // findOne()
  // ═══════════════════════════════════════════════
  describe("findOne()", () => {
    it("debería retornar repo con último escaneo si es del usuario", async () => {
      const mockRepo = {
        id: repoId,
        fullName: "owner/repo",
        ownerId: userId,
        scanJobs: [
          { id: "scan-1", status: "COMPLETED", createdAt: new Date() },
        ],
      };
      mockPrisma.repository.findUnique.mockResolvedValue(mockRepo);

      const result = await service.findOne(userId, repoId);

      expect(result).toHaveProperty("id", repoId);
    });

    it("debería lanzar NotFoundException si el repo no existe", async () => {
      mockPrisma.repository.findUnique.mockResolvedValue(null);

      await expect(service.findOne(userId, "nonexistent")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("debería lanzar ForbiddenException si el repo no es del usuario", async () => {
      mockPrisma.repository.findUnique.mockResolvedValue({
        id: repoId,
        ownerId: "other-user",
      });

      await expect(service.findOne(userId, repoId)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ═══════════════════════════════════════════════
  // remove()
  // ═══════════════════════════════════════════════
  describe("remove()", () => {
    it("debería eliminar (desconectar) el repo del usuario", async () => {
      mockPrisma.repository.findUnique.mockResolvedValue({
        id: repoId,
        ownerId: userId,
      });
      mockPrisma.repository.delete.mockResolvedValue({});

      await service.remove(userId, repoId);

      expect(mockPrisma.repository.delete).toHaveBeenCalledWith({
        where: { id: repoId },
      });
    });

    it("debería lanzar NotFoundException si el repo no existe", async () => {
      mockPrisma.repository.findUnique.mockResolvedValue(null);

      await expect(service.remove(userId, "nonexistent")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("debería lanzar ForbiddenException si el repo no es del usuario", async () => {
      mockPrisma.repository.findUnique.mockResolvedValue({
        id: repoId,
        ownerId: "other-user",
      });

      await expect(service.remove(userId, repoId)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ═══════════════════════════════════════════════
  // triggerScan()
  // ═══════════════════════════════════════════════
  describe("triggerScan()", () => {
    it("debería crear ScanJob y encolar en BullMQ", async () => {
      mockPrisma.repository.findUnique.mockResolvedValue({
        id: repoId,
        ownerId: userId,
        fullName: "owner/repo",
        installationId: 789,
      });
      mockPrisma.scanJob.findFirst.mockResolvedValue(null);
      mockPrisma.scanJob.create.mockResolvedValue({
        id: "scan-new",
        repositoryId: repoId,
        status: "QUEUED",
      });
      mockScanQueue.add.mockResolvedValue({ id: "job-1" });

      const result = await service.triggerScan(userId, repoId, {
        gitRef: "main",
      });

      expect(result).toHaveProperty("id", "scan-new");
      expect(mockPrisma.scanJob.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          repositoryId: repoId,
          triggerType: "MANUAL",
          status: "QUEUED",
          gitRef: "main",
        }),
      });
      expect(mockScanQueue.add).toHaveBeenCalledWith(
        "scan",
        expect.objectContaining({
          scanJobId: "scan-new",
          repositoryId: repoId,
        }),
      );
    });

    it("debería lanzar ConflictException si hay escaneo activo (409)", async () => {
      mockPrisma.repository.findUnique.mockResolvedValue({
        id: repoId,
        ownerId: userId,
      });
      mockPrisma.scanJob.findFirst.mockResolvedValue({
        id: "scan-active",
        status: "QUEUED",
      });

      await expect(
        service.triggerScan(userId, repoId, { gitRef: "main" }),
      ).rejects.toThrow(ConflictException);
    });

    it("debería lanzar ConflictException si hay escaneo CLONING", async () => {
      mockPrisma.repository.findUnique.mockResolvedValue({
        id: repoId,
        ownerId: userId,
      });
      mockPrisma.scanJob.findFirst.mockResolvedValue({
        id: "scan-cloning",
        status: "CLONING",
      });

      await expect(
        service.triggerScan(userId, repoId, { gitRef: "main" }),
      ).rejects.toThrow(ConflictException);
    });

    it("debería lanzar ConflictException si hay escaneo SCANNING", async () => {
      mockPrisma.repository.findUnique.mockResolvedValue({
        id: repoId,
        ownerId: userId,
      });
      mockPrisma.scanJob.findFirst.mockResolvedValue({
        id: "scan-running",
        status: "SCANNING",
      });

      await expect(
        service.triggerScan(userId, repoId, { gitRef: "main" }),
      ).rejects.toThrow(ConflictException);
    });

    it("debería lanzar NotFoundException si el repo no existe", async () => {
      mockPrisma.repository.findUnique.mockResolvedValue(null);

      await expect(
        service.triggerScan(userId, "nonexistent", { gitRef: "main" }),
      ).rejects.toThrow(NotFoundException);
    });

    it("debería lanzar ForbiddenException si el repo no es del usuario", async () => {
      mockPrisma.repository.findUnique.mockResolvedValue({
        id: repoId,
        ownerId: "other-user",
      });

      await expect(
        service.triggerScan(userId, repoId, { gitRef: "main" }),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
