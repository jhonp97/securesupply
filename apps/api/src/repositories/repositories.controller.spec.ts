// ─────────────────────────────────────────────
// Tests unitarios — RepositoriesController
// Cubre: GET /repositories, POST /repositories,
//        GET /repositories/:id, DELETE /repositories/:id,
//        POST /repositories/:id/scan
// TDD: RED → GREEN → REFACTOR
// ─────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock del servicio ──
const mockRepositoriesService = {
  findAll: vi.fn(),
  create: vi.fn(),
  findOne: vi.fn(),
  remove: vi.fn(),
  triggerScan: vi.fn(),
};

describe("RepositoriesController", () => {
  let RepositoriesController: any;
  let controller: any;

  const mockUser = { sub: "user-1", email: "user@example.com", role: "VIEWER" };

  beforeEach(async () => {
    vi.clearAllMocks();

    if (!RepositoriesController) {
      const mod = await import("./repositories.controller");
      RepositoriesController = mod.RepositoriesController;
    }

    controller = new RepositoriesController(mockRepositoriesService as any);
  });

  // ═══════════════════════════════════════════════
  // GET /repositories
  // ═══════════════════════════════════════════════
  describe("findAll()", () => {
    it("debería retornar lista de repos del usuario autenticado", async () => {
      const mockResult = { data: [{ id: "repo-1" }], total: 1, page: 1 };
      mockRepositoriesService.findAll.mockResolvedValue(mockResult);

      const mockReq: any = { user: mockUser };
      const result = await controller.findAll(mockReq);

      expect(result).toEqual(mockResult);
      expect(mockRepositoriesService.findAll).toHaveBeenCalledWith("user-1");
    });
  });

  // ═══════════════════════════════════════════════
  // POST /repositories
  // ═══════════════════════════════════════════════
  describe("create()", () => {
    it("debería crear un repositorio vinculado al usuario", async () => {
      const dto = { fullName: "octocat/hello-world" };
      const mockRepo = { id: "repo-new", fullName: dto.fullName };
      mockRepositoriesService.create.mockResolvedValue(mockRepo);

      const mockReq: any = { user: mockUser };
      const result = await controller.create(dto, mockReq);

      expect(result).toEqual(mockRepo);
      expect(mockRepositoriesService.create).toHaveBeenCalledWith(
        "user-1",
        dto,
      );
    });
  });

  // ═══════════════════════════════════════════════
  // GET /repositories/:id
  // ═══════════════════════════════════════════════
  describe("findOne()", () => {
    it("debería retornar detalle del repositorio", async () => {
      const mockRepo = {
        id: "repo-1",
        fullName: "owner/repo",
        scanJobs: [],
      };
      mockRepositoriesService.findOne.mockResolvedValue(mockRepo);

      const mockReq: any = { user: mockUser };
      const result = await controller.findOne("repo-1", mockReq);

      expect(result).toEqual(mockRepo);
      expect(mockRepositoriesService.findOne).toHaveBeenCalledWith(
        "user-1",
        "repo-1",
      );
    });
  });

  // ═══════════════════════════════════════════════
  // DELETE /repositories/:id
  // ═══════════════════════════════════════════════
  describe("remove()", () => {
    it("debería desconectar el repositorio", async () => {
      mockRepositoriesService.remove.mockResolvedValue(undefined);

      const mockReq: any = { user: mockUser };
      const result = await controller.remove("repo-1", mockReq);

      expect(result).toEqual({ message: "Repositorio desconectado" });
      expect(mockRepositoriesService.remove).toHaveBeenCalledWith(
        "user-1",
        "repo-1",
      );
    });
  });

  // ═══════════════════════════════════════════════
  // POST /repositories/:id/scan
  // ═══════════════════════════════════════════════
  describe("triggerScan()", () => {
    it("debería disparar un escaneo manual", async () => {
      const mockScanJob = { id: "scan-1", status: "QUEUED" };
      mockRepositoriesService.triggerScan.mockResolvedValue(mockScanJob);

      const mockReq: any = { user: mockUser };
      const dto = { gitRef: "main" };
      const result = await controller.triggerScan("repo-1", dto, mockReq);

      expect(result).toEqual(mockScanJob);
      expect(mockRepositoriesService.triggerScan).toHaveBeenCalledWith(
        "user-1",
        "repo-1",
        dto,
      );
    });

    it("debería usar gitRef 'main' por default", async () => {
      const mockScanJob = { id: "scan-1", status: "QUEUED" };
      mockRepositoriesService.triggerScan.mockResolvedValue(mockScanJob);

      const mockReq: any = { user: mockUser };
      const dto = { gitRef: "main" }; // default del schema
      await controller.triggerScan("repo-1", dto, mockReq);

      expect(mockRepositoriesService.triggerScan).toHaveBeenCalledWith(
        "user-1",
        "repo-1",
        expect.objectContaining({ gitRef: "main" }),
      );
    });
  });
});
