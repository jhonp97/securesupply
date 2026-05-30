// ─────────────────────────────────────────────
// Tests unitarios — GitHubService
// Cubre: createAppClient, getInstallationToken,
//        getRepoInfo, manejo de errores
// TDD: RED → GREEN → REFACTOR
// ─────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Mocks de octokit ──
const mockGetInstallationOctokit = vi.fn();
const mockAppOctokit = {
  rest: {
    repos: {
      get: vi.fn(),
    },
  },
};

vi.mock("octokit", () => ({
  App: vi.fn(() => ({
    octokit: mockAppOctokit,
    getInstallationOctokit: mockGetInstallationOctokit,
  })),
}));

// ── Mock de @octokit/auth-app ──
const mockAuth = vi.fn();

vi.mock("@octokit/auth-app", () => ({
  createAppAuth: vi.fn(() => mockAuth),
}));

// ── Variables de entorno para tests ──
const TEST_APP_ID = "12345";
const TEST_PRIVATE_KEY = `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA0Z3VS5JJcds3xfn/ygWyF8PbnGy0AHB7MhgHcTz6sE2I2yPB
aFDrBz9vFqU5y1y6Kxz7xD1sU5aLyL4y3eGM7b0YvFq7mKhV7p0GZuo8aX3m
-----END RSA PRIVATE KEY-----`;

describe("GitHubService", () => {
  let GitHubService: any;
  let service: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Configurar variables de entorno
    process.env["GITHUB_APP_ID"] = TEST_APP_ID;
    process.env["GITHUB_APP_PRIVATE_KEY"] = TEST_PRIVATE_KEY;

    if (!GitHubService) {
      const mod = await import("./github.service");
      GitHubService = mod.GitHubService;
    }
    service = new GitHubService();
  });

  afterEach(() => {
    delete process.env["GITHUB_APP_ID"];
    delete process.env["GITHUB_APP_PRIVATE_KEY"];
  });

  // ═══════════════════════════════════════════════
  // createAppClient()
  // ═══════════════════════════════════════════════
  describe("createAppClient()", () => {
    it("debería crear un cliente autenticado como GitHub App", () => {
      const client = service.createAppClient();
      expect(client).toBeDefined();
      expect(client).toHaveProperty("octokit");
    });

    it("debería reutilizar la misma instancia de App", () => {
      const client1 = service.createAppClient();
      const client2 = service.createAppClient();
      expect(client1).toBe(client2);
    });
  });

  // ═══════════════════════════════════════════════
  // getInstallationToken()
  // ═══════════════════════════════════════════════
  describe("getInstallationToken()", () => {
    it("debería generar un token de instalación de corta duración", async () => {
      mockAuth.mockResolvedValue({ token: "ghs_mock_installation_token" });

      const token = await service.getInstallationToken(12345);

      expect(token).toBe("ghs_mock_installation_token");
      expect(mockAuth).toHaveBeenCalledWith({ type: "installation" });
    });

    it("debería lanzar error si la instalación es inválida", async () => {
      mockAuth.mockRejectedValue(new Error("Installation not found"));

      await expect(service.getInstallationToken(99999)).rejects.toThrow(
        "Installation not found",
      );
    });
  });

  // ═══════════════════════════════════════════════
  // getRepoInfo()
  // ═══════════════════════════════════════════════
  describe("getRepoInfo()", () => {
    it("debería retornar metadata del repositorio", async () => {
      const mockRepoData = {
        data: {
          id: 123456,
          full_name: "octocat/hello-world",
          default_branch: "main",
          private: false,
          html_url: "https://github.com/octocat/hello-world",
        },
      };

      const mockInstallationOctokit = {
        rest: { repos: { get: vi.fn().mockResolvedValue(mockRepoData) } },
      };
      mockGetInstallationOctokit.mockResolvedValue(mockInstallationOctokit);

      const result = await service.getRepoInfo(
        "octocat",
        "hello-world",
        12345,
      );

      expect(result).toBeDefined();
      expect(result.full_name).toBe("octocat/hello-world");
      expect(result.default_branch).toBe("main");
      expect(result.private).toBe(false);
      expect(mockInstallationOctokit.rest.repos.get).toHaveBeenCalledWith({
        owner: "octocat",
        repo: "hello-world",
      });
    });

    it("debería lanzar error si el repositorio no existe", async () => {
      const mockInstallationOctokit = {
        rest: {
          repos: {
            get: vi.fn().mockRejectedValue(new Error("Not Found")),
          },
        },
      };
      mockGetInstallationOctokit.mockResolvedValue(mockInstallationOctokit);

      await expect(
        service.getRepoInfo("owner", "nonexistent", 12345),
      ).rejects.toThrow("Not Found");
    });
  });

  // ═══════════════════════════════════════════════
  // Seguridad — no almacenar tokens
  // ═══════════════════════════════════════════════
  describe("seguridad de tokens", () => {
    it("NO debería almacenar tokens de instalación como propiedad del servicio", async () => {
      mockAuth.mockResolvedValue({ token: "ghs_temp_token" });

      await service.getInstallationToken(12345);

      // Verificar que no hay propiedad de token almacenada en el servicio
      const keys = Object.keys(service);
      const tokenKeys = keys.filter(
        (k) =>
          k.toLowerCase().includes("token") &&
          typeof service[k] === "string",
      );
      expect(tokenKeys).toHaveLength(0);
    });
  });
});
