// ─────────────────────────────────────────────
// Tests unitarios — WebhookPayloadDto (Zod)
// Cubre: validación de payload de webhook GitHub
//        para eventos push y pull_request
// TDD: RED → GREEN → REFACTOR
// ─────────────────────────────────────────────

import { describe, it, expect } from "vitest";
import { WebhookPayloadSchema } from "./webhook-payload.dto";

describe("WebhookPayloadSchema", () => {
  // ═══════════════════════════════════════════════
  // Payload válido — evento push
  // ═══════════════════════════════════════════════
  describe("payload de push válido", () => {
    const validPushPayload = {
      ref: "refs/heads/main",
      repository: {
        id: 123456,
        full_name: "octocat/hello-world",
        default_branch: "main",
        private: false,
      },
      installation: {
        id: 789,
      },
    };

    it("debería parsear un payload de push válido", () => {
      const result = WebhookPayloadSchema.safeParse(validPushPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.repository.full_name).toBe("octocat/hello-world");
        expect(result.data.ref).toBe("refs/heads/main");
        expect(result.data.installation.id).toBe(789);
      }
    });
  });

  // ═══════════════════════════════════════════════
  // Payload válido — evento pull_request
  // ═══════════════════════════════════════════════
  describe("payload de pull_request válido", () => {
    const validPrPayload = {
      ref: "refs/heads/feature-branch",
      repository: {
        id: 654321,
        full_name: "owner/private-repo",
        default_branch: "main",
        private: true,
      },
      installation: {
        id: 111,
      },
    };

    it("debería parsear un payload de pull_request válido", () => {
      const result = WebhookPayloadSchema.safeParse(validPrPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.repository.private).toBe(true);
        expect(result.data.installation.id).toBe(111);
      }
    });
  });

  // ═══════════════════════════════════════════════
  // Payloads inválidos
  // ═══════════════════════════════════════════════
  describe("payloads inválidos", () => {
    it("debería rechazar payload sin ref", () => {
      const result = WebhookPayloadSchema.safeParse({
        repository: {
          id: 123,
          full_name: "owner/repo",
          default_branch: "main",
          private: false,
        },
        installation: { id: 1 },
      });
      expect(result.success).toBe(false);
    });

    it("debería rechazar payload sin repository", () => {
      const result = WebhookPayloadSchema.safeParse({
        ref: "refs/heads/main",
        installation: { id: 1 },
      });
      expect(result.success).toBe(false);
    });

    it("debería rechazar payload sin installation", () => {
      const result = WebhookPayloadSchema.safeParse({
        ref: "refs/heads/main",
        repository: {
          id: 123,
          full_name: "owner/repo",
          default_branch: "main",
          private: false,
        },
      });
      expect(result.success).toBe(false);
    });

    it("debería rechazar repository sin full_name", () => {
      const result = WebhookPayloadSchema.safeParse({
        ref: "refs/heads/main",
        repository: {
          id: 123,
          default_branch: "main",
          private: false,
        },
        installation: { id: 1 },
      });
      expect(result.success).toBe(false);
    });

    it("debería rechazar installation sin id", () => {
      const result = WebhookPayloadSchema.safeParse({
        ref: "refs/heads/main",
        repository: {
          id: 123,
          full_name: "owner/repo",
          default_branch: "main",
          private: false,
        },
        installation: {},
      });
      expect(result.success).toBe(false);
    });

    it("debería rechazar payload vacío", () => {
      const result = WebhookPayloadSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════
  // Inferencia de tipos
  // ═══════════════════════════════════════════════
  describe("tipos inferidos", () => {
    it("debería inferir el tipo WebhookPayload correctamente", () => {
      const payload = {
        ref: "refs/heads/main",
        repository: {
          id: 1,
          full_name: "owner/repo",
          default_branch: "main",
          private: false,
        },
        installation: {
          id: 1,
        },
      };

      const result = WebhookPayloadSchema.parse(payload);
      // Si compila, la inferencia de tipos es correcta
      expect(result.repository.id).toBe(1);
      expect(typeof result.repository.private).toBe("boolean");
    });
  });
});
