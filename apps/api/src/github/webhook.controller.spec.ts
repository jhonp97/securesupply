// ─────────────────────────────────────────────
// Tests unitarios — WebhookController
// Cubre: verificación HMAC, manejo de eventos
//        push y pull_request, repos no vinculados,
//        encolado de escaneo
// TDD: RED → GREEN → REFACTOR
// ─────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock del Webhooks de @octokit/webhooks ──
const mockVerify = vi.fn();

vi.mock("@octokit/webhooks", () => ({
  Webhooks: vi.fn(() => ({
    verify: mockVerify,
  })),
}));

// ── Mocks de servicios ──
const mockGitHubService = {
  getRepoInfo: vi.fn(),
};

const mockPrisma = {
  repository: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  scanJob: {
    create: vi.fn(),
  },
};

const mockScanQueue = {
  add: vi.fn(),
};

describe("WebhookController", () => {
  let WebhookController: any;
  let controller: any;

  const WEBHOOK_SECRET = "test-webhook-secret-that-is-at-least-20-chars";

  beforeEach(async () => {
    vi.clearAllMocks();
    process.env["GITHUB_WEBHOOK_SECRET"] = WEBHOOK_SECRET;

    if (!WebhookController) {
      const mod = await import("./webhook.controller");
      WebhookController = mod.WebhookController;
    }

    controller = new WebhookController(
      mockGitHubService as any,
      mockPrisma as any,
      mockScanQueue as any,
    );
  });

  // ═══════════════════════════════════════════════
  // Verificación HMAC
  // ═══════════════════════════════════════════════
  describe("verificación de firma HMAC", () => {
    const validPayload = JSON.stringify({
      ref: "refs/heads/main",
      repository: {
        id: 123,
        full_name: "owner/repo",
        default_branch: "main",
        private: false,
      },
      installation: { id: 1 },
    });

    it("debería rechazar request con firma inválida (401)", async () => {
      mockVerify.mockResolvedValue(false);

      const mockReq: any = {
        headers: {
          "x-github-event": "push",
          "x-github-delivery": "delivery-123",
          "x-hub-signature-256": "sha256=invalid_signature",
        },
        rawBody: Buffer.from(validPayload),
      };

      await expect(controller.handleWebhook(mockReq)).rejects.toThrow();
    });

    it("debería rechazar request sin header de firma", async () => {
      const mockReq: any = {
        headers: {
          "x-github-event": "push",
          "x-github-delivery": "delivery-123",
        },
        rawBody: Buffer.from(validPayload),
      };

      await expect(controller.handleWebhook(mockReq)).rejects.toThrow();
    });

    it("debería rechazar request sin rawBody", async () => {
      const mockReq: any = {
        headers: {
          "x-github-event": "push",
          "x-github-delivery": "delivery-123",
          "x-hub-signature-256": "sha256=something",
        },
      };

      await expect(controller.handleWebhook(mockReq)).rejects.toThrow();
    });
  });

  // ═══════════════════════════════════════════════
  // Evento push
  // ═══════════════════════════════════════════════
  describe("evento push", () => {
    const pushPayload = {
      ref: "refs/heads/main",
      repository: {
        id: 123456,
        full_name: "octocat/hello-world",
        default_branch: "main",
        private: false,
      },
      installation: { id: 789 },
    };

    it("debería procesar evento push y encolar escaneo para repo existente", async () => {
      mockVerify.mockResolvedValue(true);
      mockPrisma.repository.findUnique.mockResolvedValue({
        id: "repo-1",
        githubId: 123456,
        fullName: "octocat/hello-world",
      });
      mockPrisma.scanJob.create.mockResolvedValue({ id: "scan-1" });
      mockScanQueue.add.mockResolvedValue({ id: "job-1" });

      const mockReq: any = {
        headers: {
          "x-github-event": "push",
          "x-github-delivery": "delivery-123",
          "x-hub-signature-256": "sha256=valid",
        },
        rawBody: Buffer.from(JSON.stringify(pushPayload)),
      };

      const result = await controller.handleWebhook(mockReq);

      expect(result).toHaveProperty("message");
      expect(mockScanQueue.add).toHaveBeenCalledWith(
        "scan",
        expect.objectContaining({
          repositoryId: "repo-1",
          gitRef: "main",
          installationId: 789,
        }),
      );
    });

    it("debería ignorar evento si el repo no está vinculado", async () => {
      mockVerify.mockResolvedValue(true);
      mockPrisma.repository.findUnique.mockResolvedValue(null);

      const mockReq: any = {
        headers: {
          "x-github-event": "push",
          "x-github-delivery": "delivery-123",
          "x-hub-signature-256": "sha256=valid",
        },
        rawBody: Buffer.from(JSON.stringify(pushPayload)),
      };

      const result = await controller.handleWebhook(mockReq);

      expect(result.message).toContain("no vinculado");
      expect(mockScanQueue.add).not.toHaveBeenCalled();
    });

    it("debería actualizar installationId si el repo existe por fullName", async () => {
      mockVerify.mockResolvedValue(true);
      // Primera llamada (por githubId): null
      // Segunda llamada (por fullName): repo existente
      mockPrisma.repository.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: "repo-1",
          githubId: null,
          fullName: "octocat/hello-world",
        });
      mockPrisma.repository.update.mockResolvedValue({});
      mockPrisma.scanJob.create.mockResolvedValue({ id: "scan-1" });
      mockScanQueue.add.mockResolvedValue({ id: "job-1" });

      const mockReq: any = {
        headers: {
          "x-github-event": "push",
          "x-github-delivery": "delivery-123",
          "x-hub-signature-256": "sha256=valid",
        },
        rawBody: Buffer.from(JSON.stringify(pushPayload)),
      };

      await controller.handleWebhook(mockReq);

      expect(mockPrisma.repository.update).toHaveBeenCalledWith({
        where: { id: "repo-1" },
        data: { installationId: 789 },
      });
      expect(mockScanQueue.add).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════
  // Evento pull_request
  // ═══════════════════════════════════════════════
  describe("evento pull_request", () => {
    const prPayload = {
      ref: "refs/heads/feature-branch",
      repository: {
        id: 654321,
        full_name: "owner/private-repo",
        default_branch: "main",
        private: true,
      },
      installation: { id: 111 },
    };

    it("debería procesar evento pull_request y encolar escaneo", async () => {
      mockVerify.mockResolvedValue(true);
      mockPrisma.repository.findUnique.mockResolvedValue({
        id: "repo-2",
        githubId: 654321,
      });
      mockPrisma.scanJob.create.mockResolvedValue({ id: "scan-2" });
      mockScanQueue.add.mockResolvedValue({ id: "job-2" });

      const mockReq: any = {
        headers: {
          "x-github-event": "pull_request",
          "x-github-delivery": "delivery-456",
          "x-hub-signature-256": "sha256=valid",
        },
        rawBody: Buffer.from(JSON.stringify(prPayload)),
      };

      const result = await controller.handleWebhook(mockReq);

      expect(result).toHaveProperty("message");
      expect(mockScanQueue.add).toHaveBeenCalledWith(
        "scan",
        expect.objectContaining({
          gitRef: "feature-branch",
        }),
      );
    });
  });

  // ═══════════════════════════════════════════════
  // Eventos ignorados
  // ═══════════════════════════════════════════════
  describe("eventos ignorados", () => {
    it("debería retornar 'Evento ignorado' para eventos no soportados", async () => {
      mockVerify.mockResolvedValue(true);

      const mockReq: any = {
        headers: {
          "x-github-event": "star",
          "x-github-delivery": "delivery-789",
          "x-hub-signature-256": "sha256=valid",
        },
        rawBody: Buffer.from(JSON.stringify({ action: "created" })),
      };

      const result = await controller.handleWebhook(mockReq);

      expect(result).toEqual({ message: "Evento ignorado" });
      expect(mockPrisma.repository.findUnique).not.toHaveBeenCalled();
      expect(mockScanQueue.add).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════
  // Payload malformado
  // ═══════════════════════════════════════════════
  describe("payload malformado", () => {
    it("debería retornar 400 para payload que no pasa validación Zod", async () => {
      mockVerify.mockResolvedValue(true);

      const mockReq: any = {
        headers: {
          "x-github-event": "push",
          "x-github-delivery": "delivery-bad",
          "x-hub-signature-256": "sha256=valid",
        },
        rawBody: Buffer.from(JSON.stringify({ invalid: "payload" })),
      };

      await expect(controller.handleWebhook(mockReq)).rejects.toThrow();
    });
  });
});
