// ─────────────────────────────────────────────
// Tests unitarios — AuthGuard (JWT)
// Cubre: extracción de token, verificación,
//        errores de token inválido/expirado
// TDD: RED → GREEN → REFACTOR
// ─────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from "vitest";
import { UnauthorizedException } from "@nestjs/common";

// Configurar JWT_SECRET antes de importar el módulo
process.env["JWT_SECRET"] = "test-secret-that-is-at-least-32-characters-long!!";

// Mock completo de jsonwebtoken
const mockVerify = vi.fn();
vi.mock("jsonwebtoken", () => ({
  default: { verify: mockVerify },
  verify: mockVerify,
}));

describe("AuthGuard", () => {
  let AuthGuard: any;
  let authGuard: any;
  let mockReflector: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockReflector = { get: vi.fn() };

    if (!AuthGuard) {
      const mod = await import("./auth.guard");
      AuthGuard = mod.AuthGuard;
    }
    authGuard = new AuthGuard(mockReflector);
  });

  describe("canActivate()", () => {
    const mockPayload = {
      sub: "user-1",
      email: "user@example.com",
      role: "VIEWER",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    };

    it("debería permitir acceso con token Bearer válido", () => {
      const mockRequest = {
        headers: { authorization: "Bearer valid.jwt.token" },
        user: undefined,
      };
      const mockContext: any = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
      };

      mockVerify.mockReturnValue(mockPayload);

      const result = authGuard.canActivate(mockContext);

      expect(result).toBe(true);
      expect(mockRequest).toHaveProperty("user");
      expect(mockRequest.user).toEqual(mockPayload);
    });

    it("debería lanzar 401 si no hay header Authorization", () => {
      const mockRequest = { headers: {}, user: undefined };
      const mockContext: any = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
      };

      expect(() => authGuard.canActivate(mockContext)).toThrow(
        UnauthorizedException,
      );
    });

    it("debería lanzar 401 si el token no es Bearer", () => {
      const mockRequest = {
        headers: { authorization: "Basic credentials" },
        user: undefined,
      };
      const mockContext: any = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
      };

      expect(() => authGuard.canActivate(mockContext)).toThrow(
        UnauthorizedException,
      );
    });

    it("debería lanzar 401 si el token es inválido/expirado", () => {
      const mockRequest = {
        headers: { authorization: "Bearer invalid.token.here" },
        user: undefined,
      };
      const mockContext: any = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
      };

      mockVerify.mockImplementation(() => {
        throw new Error("jwt expired");
      });

      expect(() => authGuard.canActivate(mockContext)).toThrow(
        UnauthorizedException,
      );
    });
  });
});
