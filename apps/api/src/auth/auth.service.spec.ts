// ─────────────────────────────────────────────
// Tests unitarios — AuthService
// Cubre: register, login, refresh, logout,
//        reuse attack detection
// TDD: RED → GREEN → REFACTOR
// ─────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConflictException, UnauthorizedException } from "@nestjs/common";
import * as crypto from "node:crypto";

// ── Mocks hoisted (vitest los mueve al tope del archivo) ──

vi.mock("bcrypt", () => ({
  hash: vi.fn(),
  compare: vi.fn(),
}));

vi.mock("@nestjs/jwt", () => ({
  JwtService: vi.fn(() => ({
    sign: vi.fn().mockReturnValue("jwt-access-token"),
    verify: vi.fn(),
  })),
}));

import * as bcrypt from "bcrypt";

// ── Mock de PrismaService ─────────────────────
const mockPrisma = {
  user: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  refreshToken: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
};

const mockJwtService = {
  sign: vi.fn().mockReturnValue("jwt-access-token"),
  verify: vi.fn(),
};

// ── Módulo a testear ──────────────────────────
let AuthService: any;
let authService: any;

describe("AuthService", () => {
  beforeEach(async () => {
    vi.clearAllMocks();

    if (!AuthService) {
      const mod = await import("./auth.service");
      AuthService = mod.AuthService;
    }
    authService = new AuthService(mockPrisma as any, mockJwtService as any);
  });

  // ═══════════════════════════════════════════════
  // register()
  // ═══════════════════════════════════════════════
  describe("register()", () => {
    const registerDto = {
      email: "user@example.com",
      password: "SecurePass123!",
    };

    it("debería crear un usuario exitosamente y retornar void", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      (bcrypt.hash as any).mockResolvedValue("$2b$12$hashedpassword");
      mockPrisma.user.create.mockResolvedValue({
        id: "clx123",
        email: registerDto.email,
        role: "VIEWER",
      });

      const result = await authService.register(registerDto);

      expect(result).toBeUndefined();
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: registerDto.email },
      });
      expect(bcrypt.hash).toHaveBeenCalledWith(registerDto.password, 12);
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: {
          email: registerDto.email,
          passwordHash: "$2b$12$hashedpassword",
        },
      });
    });

    it("debería lanzar ConflictException si el email ya existe", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "existing-id",
        email: registerDto.email,
      });

      await expect(authService.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });

    it("debería usar bcrypt cost factor 12 para password", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      (bcrypt.hash as any).mockResolvedValue("hash");

      await authService.register({
        email: "new@example.com",
        password: "SecurePass123!",
      });

      expect(bcrypt.hash).toHaveBeenCalledWith(expect.any(String), 12);
    });
  });

  // ═══════════════════════════════════════════════
  // login()
  // ═══════════════════════════════════════════════
  describe("login()", () => {
    const loginDto = { email: "user@example.com", password: "correct-pass" };
    const mockUser = {
      id: "user-1",
      email: "user@example.com",
      passwordHash: "$2b$12$hashedpassword",
      role: "VIEWER",
    };
    let mockResponse: any;

    beforeEach(() => {
      mockResponse = { cookie: vi.fn() };
      mockJwtService.sign.mockReturnValue("jwt-access-token");
      (bcrypt.compare as any).mockResolvedValue(true);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.refreshToken.create.mockResolvedValue({
        id: "rt-1",
        tokenHash: "sha256hash",
        userId: "user-1",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });
    });

    it("debería retornar accessToken y setear cookie", async () => {
      const result = await authService.login(loginDto, mockResponse);

      expect(result).toHaveProperty("accessToken");
      expect(result.accessToken).toBe("jwt-access-token");
      expect(mockJwtService.sign).toHaveBeenCalledWith(
        { sub: "user-1", email: "user@example.com", role: "VIEWER" },
        { expiresIn: "1h" },
      );
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        "refresh_token",
        expect.any(String),
        expect.objectContaining({
          httpOnly: true,
          sameSite: "strict",
          maxAge: expect.any(Number),
        }),
      );
    });

    it("debería lanzar UnauthorizedException si el usuario no existe", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        authService.login(
          { email: "nobody@example.com", password: "irrelevant" },
          mockResponse,
        ),
      ).rejects.toThrow(UnauthorizedException);
      expect(mockResponse.cookie).not.toHaveBeenCalled();
    });

    it("debería lanzar UnauthorizedException si la contraseña es incorrecta", async () => {
      (bcrypt.compare as any).mockResolvedValue(false);

      await expect(
        authService.login(loginDto, mockResponse),
      ).rejects.toThrow(UnauthorizedException);
      expect(mockResponse.cookie).not.toHaveBeenCalled();
    });

    it("debería usar el mismo mensaje para usuario no encontrado y password incorrecto", async () => {
      // Usuario no existe
      mockPrisma.user.findUnique.mockResolvedValue(null);
      let error1: any;
      try {
        await authService.login(
          { email: "nobody@example.com", password: "pass" },
          mockResponse,
        );
      } catch (e: any) {
        error1 = e;
      }

      // Password incorrecto
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as any).mockResolvedValue(false);
      let error2: any;
      try {
        await authService.login(loginDto, mockResponse);
      } catch (e: any) {
        error2 = e;
      }

      expect(error1.message).toBe(error2.message);
    });

    it("debería crear RefreshToken en BD con SHA-256 + bcrypt", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as any).mockResolvedValue(true);
      mockJwtService.sign.mockReturnValue("jwt-access-token");

      await authService.login(loginDto, mockResponse);

      expect(mockPrisma.refreshToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: "user-1",
            tokenHash: expect.any(String),
            token: expect.any(String),
            expiresAt: expect.any(Date),
          }),
        }),
      );
    });
  });

  // ═══════════════════════════════════════════════
  // refresh()
  // ═══════════════════════════════════════════════
  describe("refresh()", () => {
    const rawRefreshToken = "a".repeat(64);
    const mockResponse = { cookie: vi.fn() };
    const mockStoredToken = {
      id: "rt-1",
      tokenHash: crypto
        .createHash("sha256")
        .update(rawRefreshToken)
        .digest("hex"),
      token: "$2b$10$hashedrefreshtoken",
      userId: "user-1",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      revokedAt: null,
      user: { id: "user-1", email: "user@example.com", role: "VIEWER" },
    };

    beforeEach(() => {
      vi.clearAllMocks();
      mockJwtService.sign.mockReturnValue("new-jwt-access-token");
      mockPrisma.refreshToken.findUnique.mockResolvedValue(mockStoredToken);
      (bcrypt.compare as any).mockResolvedValue(true);
      mockPrisma.refreshToken.update.mockResolvedValue({});
      mockPrisma.refreshToken.create.mockResolvedValue({
        id: "rt-2",
        tokenHash: "newhash",
        userId: "user-1",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });
    });

    it("debería rotar tokens exitosamente", async () => {
      const result = await authService.refresh(rawRefreshToken, mockResponse);

      expect(result).toHaveProperty("accessToken");
      expect(result.accessToken).toBe("new-jwt-access-token");
      expect(mockPrisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: "rt-1" },
        data: { revokedAt: expect.any(Date) },
      });
      expect(mockPrisma.refreshToken.create).toHaveBeenCalled();
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        "refresh_token",
        expect.any(String),
        expect.any(Object),
      );
    });

    it("debería lanzar 401 si el refresh token no existe en BD", async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue(null);

      await expect(
        authService.refresh("nonexistenttoken", mockResponse),
      ).rejects.toThrow(UnauthorizedException);
      expect(mockResponse.cookie).not.toHaveBeenCalled();
    });

    it("debería lanzar 401 si el token está expirado", async () => {
      const expiredToken = {
        ...mockStoredToken,
        expiresAt: new Date(Date.now() - 1000),
      };
      mockPrisma.refreshToken.findUnique.mockResolvedValue(expiredToken);

      await expect(
        authService.refresh(rawRefreshToken, mockResponse),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("debería detectar reuse attack si el token está revocado", async () => {
      const revokedToken = {
        ...mockStoredToken,
        revokedAt: new Date(Date.now() - 1000),
      };
      mockPrisma.refreshToken.findUnique.mockResolvedValue(revokedToken);

      await expect(
        authService.refresh(rawRefreshToken, mockResponse),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: "user-1", revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it("debería lanzar 401 si no se provee refresh token", async () => {
      await expect(authService.refresh("", mockResponse)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // ═══════════════════════════════════════════════
  // logout()
  // ═══════════════════════════════════════════════
  describe("logout()", () => {
    const rawRefreshToken = "a".repeat(64);
    const mockResponse = { clearCookie: vi.fn() };

    it("debería revocar el token y limpiar la cookie", async () => {
      const tokenHash = crypto
        .createHash("sha256")
        .update(rawRefreshToken)
        .digest("hex");
      mockPrisma.refreshToken.findUnique.mockResolvedValue({
        id: "rt-1",
        tokenHash,
        userId: "user-1",
      });
      mockPrisma.refreshToken.update.mockResolvedValue({});

      await authService.logout(rawRefreshToken, mockResponse);

      expect(mockPrisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: "rt-1" },
        data: { revokedAt: expect.any(Date) },
      });
      expect(mockResponse.clearCookie).toHaveBeenCalledWith(
        "refresh_token",
        expect.objectContaining({ path: "/" }),
      );
    });

    it("debería ser idempotente si no hay refresh token", async () => {
      await authService.logout("", mockResponse);

      expect(mockPrisma.refreshToken.findUnique).not.toHaveBeenCalled();
      expect(mockPrisma.refreshToken.update).not.toHaveBeenCalled();
      expect(mockResponse.clearCookie).toHaveBeenCalledWith(
        "refresh_token",
        expect.objectContaining({ path: "/" }),
      );
    });
  });
});
