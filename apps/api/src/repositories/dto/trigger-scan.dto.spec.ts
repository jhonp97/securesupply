// ─────────────────────────────────────────────
// Tests unitarios — TriggerScanDto (Zod)
// Cubre: validación de gitRef opcional
// TDD: RED → GREEN → REFACTOR
// ─────────────────────────────────────────────

import { describe, it, expect } from "vitest";
import { TriggerScanSchema } from "./trigger-scan.dto";

describe("TriggerScanSchema", () => {
  // ═══════════════════════════════════════════════
  // Payloads válidos
  // ═══════════════════════════════════════════════
  describe("payloads válidos", () => {
    it("debería aceptar gitRef como rama personalizada", () => {
      const result = TriggerScanSchema.safeParse({ gitRef: "develop" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.gitRef).toBe("develop");
      }
    });

    it("debería usar 'main' como default si no se provee gitRef", () => {
      const result = TriggerScanSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.gitRef).toBe("main");
      }
    });

    it("debería aceptar refs completas como gitRef", () => {
      const result = TriggerScanSchema.safeParse({
        gitRef: "refs/heads/feature",
      });
      expect(result.success).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════
  // Payloads inválidos
  // ═══════════════════════════════════════════════
  describe("payloads inválidos", () => {
    it("debería rechazar gitRef vacío", () => {
      const result = TriggerScanSchema.safeParse({ gitRef: "" });
      expect(result.success).toBe(false);
    });

    it("debería rechazar gitRef con path traversal", () => {
      const result = TriggerScanSchema.safeParse({ gitRef: "../../../etc" });
      expect(result.success).toBe(false);
    });

    it("debería rechazar gitRef con caracteres peligrosos", () => {
      const result = TriggerScanSchema.safeParse({ gitRef: "main; rm -rf /" });
      expect(result.success).toBe(false);
    });
  });
});
