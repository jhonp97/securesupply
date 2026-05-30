// ─────────────────────────────────────────────
// Tests unitarios — RepositoryOwnerGuard
// Cubre: verificación de ownership,
//        403 si el repo no es del usuario
// TDD: RED → GREEN → REFACTOR
// ─────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from "vitest";
import { ForbiddenException, NotFoundException } from "@nestjs/common";

const mockPrisma = {
  repository: {
    findUnique: vi.fn(),
  },
};

describe("RepositoryOwnerGuard", () => {
  let RepositoryOwnerGuard: any;
  let guard: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    if (!RepositoryOwnerGuard) {
      const mod = await import("./repository-owner.guard");
      RepositoryOwnerGuard = mod.RepositoryOwnerGuard;
    }

    guard = new RepositoryOwnerGuard(mockPrisma as any);
  });

  describe("canActivate()", () => {
    it("debería permitir acceso si el repo pertenece al usuario", () => {
      const mockRequest: any = {
        user: { sub: "user-1" },
        params: { id: "repo-1" },
      };
      const mockContext: any = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
      };

      mockPrisma.repository.findUnique.mockResolvedValue({
        id: "repo-1",
        ownerId: "user-1",
      });

      // canActivate es async por la consulta a BD
      return guard.canActivate(mockContext).then((result: boolean) => {
        expect(result).toBe(true);
      });
    });

    it("debería lanzar 403 si el repo no pertenece al usuario", async () => {
      const mockRequest: any = {
        user: { sub: "user-1" },
        params: { id: "repo-1" },
      };
      const mockContext: any = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
      };

      mockPrisma.repository.findUnique.mockResolvedValue({
        id: "repo-1",
        ownerId: "other-user",
      });

      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("debería lanzar 404 si el repo no existe", async () => {
      const mockRequest: any = {
        user: { sub: "user-1" },
        params: { id: "nonexistent" },
      };
      const mockContext: any = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
      };

      mockPrisma.repository.findUnique.mockResolvedValue(null);

      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("debería lanzar 401 si no hay usuario en el request", async () => {
      const mockRequest: any = {
        user: undefined,
        params: { id: "repo-1" },
      };
      const mockContext: any = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
      };

      await expect(guard.canActivate(mockContext)).rejects.toThrow();
    });
  });
});
