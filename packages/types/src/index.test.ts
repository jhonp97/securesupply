import { describe, it, expect } from "vitest";
import {
  ScanStatusEnum,
  RiskLevelEnum,
  RepositorySchema,
  FindingSchema,
  ScanSchema,
  UserSchema,
  WebhookSchema,
  SecurityMetricSchema,
} from "./index.js";

// ─────────────────────────────────────────────
// Tests placeholder para packages/types
// Se completarán en la fase de Testing Infrastructure
// ─────────────────────────────────────────────

describe("types", () => {
  it("exporta todos los enums de Zod", () => {
    expect(ScanStatusEnum).toBeDefined();
    expect(RiskLevelEnum).toBeDefined();
  });

  it("RepositorySchema valida un repo correcto", () => {
    const repo = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      name: "mi-repo",
      url: "https://github.com/user/repo",
      defaultBranch: "main",
      isActive: true,
      createdAt: "2026-05-25T00:00:00Z",
      updatedAt: "2026-05-25T00:00:00Z",
    };
    expect(() => RepositorySchema.parse(repo)).not.toThrow();
  });

  it("UserSchema valida un usuario correcto", () => {
    const user = {
      id: "550e8400-e29b-41d4-a716-446655440001",
      email: "test@example.com",
      displayName: "Juan Pérez",
      role: "ADMIN",
      isActive: true,
      createdAt: "2026-05-25T00:00:00Z",
      updatedAt: "2026-05-25T00:00:00Z",
    };
    expect(() => UserSchema.parse(user)).not.toThrow();
  });
});
