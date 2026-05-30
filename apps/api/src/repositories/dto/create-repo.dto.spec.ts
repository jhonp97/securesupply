// ─────────────────────────────────────────────
// Tests unitarios — CreateRepoDto (Zod)
// Cubre: validación de fullName (owner/repo),
//        anti-SSRF en URL de clonación
// TDD: RED → GREEN → REFACTOR
// ─────────────────────────────────────────────

import { describe, it, expect } from "vitest";
import { CreateRepoSchema } from "./create-repo.dto";

describe("CreateRepoSchema", () => {
  // ═══════════════════════════════════════════════
  // Payloads válidos
  // ═══════════════════════════════════════════════
  describe("payloads válidos", () => {
    it("debería aceptar fullName con formato owner/repo", () => {
      const result = CreateRepoSchema.safeParse({
        fullName: "octocat/hello-world",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.fullName).toBe("octocat/hello-world");
      }
    });

    it("debería aceptar fullName con guiones bajos y puntos", () => {
      const result = CreateRepoSchema.safeParse({
        fullName: "my_org/my.repo.js",
      });
      expect(result.success).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════
  // Payloads inválidos
  // ═══════════════════════════════════════════════
  describe("payloads inválidos", () => {
    it("debería rechazar fullName vacío", () => {
      const result = CreateRepoSchema.safeParse({ fullName: "" });
      expect(result.success).toBe(false);
    });

    it("debería rechazar fullName sin slash (formato inválido)", () => {
      const result = CreateRepoSchema.safeParse({ fullName: "just-a-repo" });
      expect(result.success).toBe(false);
    });

    it("debería rechazar fullName con múltiples slashes", () => {
      const result = CreateRepoSchema.safeParse({
        fullName: "owner/repo/extra",
      });
      expect(result.success).toBe(false);
    });

    it("debería rechazar fullName con path traversal", () => {
      const result = CreateRepoSchema.safeParse({
        fullName: "owner/../../../etc/passwd",
      });
      expect(result.success).toBe(false);
    });

    it("debería rechazar fullName con caracteres especiales peligrosos", () => {
      const result = CreateRepoSchema.safeParse({
        fullName: "owner/repo<script>",
      });
      expect(result.success).toBe(false);
    });

    it("debería rechazar payload sin fullName", () => {
      const result = CreateRepoSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it("debería rechazar fullName con solo owner (sin repo)", () => {
      const result = CreateRepoSchema.safeParse({ fullName: "owner/" });
      expect(result.success).toBe(false);
    });

    it("debería rechazar fullName con solo repo (sin owner)", () => {
      const result = CreateRepoSchema.safeParse({ fullName: "/repo" });
      expect(result.success).toBe(false);
    });
  });
});
