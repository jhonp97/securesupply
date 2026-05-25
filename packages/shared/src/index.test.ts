import { describe, it, expect } from "vitest";
import {
  APP_NAME,
  APP_VERSION,
  SCAN_COOLDOWN_MS,
  calculateRiskScore,
  isValidRepositoryPath,
  formatDate,
} from "./index.js";

// ─────────────────────────────────────────────
// Tests placeholder para packages/shared
// Se completarán en la fase de Testing Infrastructure
// ─────────────────────────────────────────────

describe("shared", () => {
  it("exporta constantes de la app", () => {
    expect(APP_NAME).toBe("SecureSupply");
    expect(APP_VERSION).toBe("0.1.0");
    expect(SCAN_COOLDOWN_MS).toBe(72 * 60 * 60 * 1000);
  });

  it("calculateRiskScore calcula correctamente", () => {
    expect(calculateRiskScore(0, 0, 0, 0)).toBe(0);
    expect(calculateRiskScore(1, 0, 0, 0)).toBe(10);
    expect(calculateRiskScore(0, 2, 0, 0)).toBe(10);
    expect(calculateRiskScore(0, 0, 5, 0)).toBe(10);
    expect(calculateRiskScore(0, 0, 0, 10)).toBe(10);
  });

  it("calculateRiskScore no excede 100", () => {
    expect(calculateRiskScore(100, 100, 100, 100)).toBe(100);
  });

  it("isValidRepositoryPath acepta paths válidos", () => {
    expect(isValidRepositoryPath("src/components/Button.tsx")).toBe(true);
    expect(isValidRepositoryPath("package.json")).toBe(true);
  });

  it("isValidRepositoryPath rechaza path traversal", () => {
    expect(isValidRepositoryPath("../etc/passwd")).toBe(false);
    expect(isValidRepositoryPath("src/../../etc/passwd")).toBe(false);
  });

  it("formatDate formatea fechas ISO", () => {
    const result = formatDate("2026-05-25T14:30:00Z");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});
