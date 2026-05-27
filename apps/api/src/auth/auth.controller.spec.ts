// ─────────────────────────────────────────────
// Tests unitarios — AuthController
// Cubre: rutas register, login, refresh, logout
// TDD: RED → GREEN → REFACTOR
// ─────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./auth.service", () => ({
  AuthService: vi.fn(() => ({
    register: vi.fn(),
    login: vi.fn(),
    refresh: vi.fn(),
    logout: vi.fn(),
  })),
}));

const mockAuthService = {
  register: vi.fn(),
  login: vi.fn(),
  refresh: vi.fn(),
  logout: vi.fn(),
};

describe("AuthController", () => {
  let AuthController: any;
  let controller: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    if (!AuthController) {
      const mod = await import("./auth.controller");
      AuthController = mod.AuthController;
    }
    controller = new AuthController(mockAuthService as any);
  });

  describe("POST /auth/register", () => {
    it("debería llamar a authService.register y retornar 201", async () => {
      const dto = { email: "user@example.com", password: "SecurePass123!" };
      mockAuthService.register.mockResolvedValue(undefined);

      const result = await controller.register(dto);

      expect(mockAuthService.register).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ message: "Usuario registrado exitosamente" });
    });
  });

  describe("POST /auth/login", () => {
    it("debería llamar a authService.login y retornar accessToken", async () => {
      const dto = { email: "user@example.com", password: "pass" };
      const mockRes = { cookie: vi.fn() };
      mockAuthService.login.mockResolvedValue({
        accessToken: "jwt-access-token",
      });

      const result = await controller.login(dto, mockRes);

      expect(mockAuthService.login).toHaveBeenCalledWith(dto, mockRes);
      expect(result).toEqual({ accessToken: "jwt-access-token" });
    });
  });

  describe("POST /auth/refresh", () => {
    it("debería llamar a authService.refresh con cookie", async () => {
      const mockReq = { cookies: { refresh_token: "refresh-token-value" } };
      const mockRes = { cookie: vi.fn() };
      mockAuthService.refresh.mockResolvedValue({
        accessToken: "new-access-token",
      });

      const result = await controller.refresh(mockReq, mockRes);

      expect(mockAuthService.refresh).toHaveBeenCalledWith(
        "refresh-token-value",
        mockRes,
      );
      expect(result).toEqual({ accessToken: "new-access-token" });
    });

    it("debería pasar undefined si no hay cookie de refresh", async () => {
      const mockReq = { cookies: {} };
      const mockRes = { cookie: vi.fn() };
      mockAuthService.refresh.mockResolvedValue({
        accessToken: "new-access-token",
      });

      await controller.refresh(mockReq, mockRes);

      expect(mockAuthService.refresh).toHaveBeenCalledWith(undefined, mockRes);
    });
  });

  describe("DELETE /auth/logout", () => {
    it("debería llamar a authService.logout", async () => {
      const mockReq = {
        cookies: { refresh_token: "refresh-token-value" },
      };
      const mockRes = { clearCookie: vi.fn() };
      mockAuthService.logout.mockResolvedValue(undefined);

      const result = await controller.logout(mockReq, mockRes);

      expect(mockAuthService.logout).toHaveBeenCalledWith(
        "refresh-token-value",
        mockRes,
      );
      expect(result).toEqual({ message: "Sesión cerrada exitosamente" });
    });

    it("debería funcionar sin cookie de refresh", async () => {
      const mockReq = { cookies: {} };
      const mockRes = { clearCookie: vi.fn() };
      mockAuthService.logout.mockResolvedValue(undefined);

      const result = await controller.logout(mockReq, mockRes);

      expect(mockAuthService.logout).toHaveBeenCalledWith(undefined, mockRes);
      expect(result).toEqual({ message: "Sesión cerrada exitosamente" });
    });
  });
});
