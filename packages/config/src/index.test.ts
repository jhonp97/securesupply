import { describe, it, expect } from "vitest";
import { loadEnv, EnvSchema } from "./index.js";

// ─────────────────────────────────────────────
// Tests placeholder para packages/config
// Se completarán en la fase de Testing Infrastructure
// ─────────────────────────────────────────────

describe("config", () => {
  it("exporta loadEnv", () => {
    expect(typeof loadEnv).toBe("function");
  });

  it("exporta EnvSchema", () => {
    expect(EnvSchema).toBeDefined();
  });

  it("EnvSchema es un objeto Zod", () => {
    expect(typeof EnvSchema.parse).toBe("function");
    expect(typeof EnvSchema.safeParse).toBe("function");
  });
});
