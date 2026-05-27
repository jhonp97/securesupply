// ─────────────────────────────────────────────
// Tests unitarios — ZodValidationPipe
// Cubre: validación de esquemas Zod en NestJS
// TDD: RED → GREEN → REFACTOR
// ─────────────────────────────────────────────

import { describe, it, expect, beforeAll } from "vitest";
import { BadRequestException } from "@nestjs/common";
import { z } from "zod";

const TestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

describe("ZodValidationPipe", () => {
  let ZodValidationPipe: any;

  beforeAll(async () => {
    const mod = await import("./zod-validation.pipe");
    ZodValidationPipe = mod.ZodValidationPipe;
  });

  it("debería pasar datos válidos sin modificarlos", () => {
    const pipe = new ZodValidationPipe(TestSchema);
    const input = { email: "user@example.com", password: "SecurePass123!" };
    const result = pipe.transform(input);
    expect(result).toEqual(input);
  });

  it("debería lanzar BadRequestException para datos inválidos", () => {
    const pipe = new ZodValidationPipe(TestSchema);
    const input = { email: "not-an-email", password: "short" };

    expect(() => pipe.transform(input)).toThrow(BadRequestException);
  });

  it("debería incluir detalles del error de Zod", () => {
    const pipe = new ZodValidationPipe(TestSchema);
    const input = { email: "bad", password: "short" };

    try {
      pipe.transform(input);
    } catch (error: any) {
      expect(error.response).toHaveProperty("errors");
      expect(Array.isArray(error.response.errors)).toBe(true);
    }
  });

  it("debería implementar PipeTransform", () => {
    const pipe = new ZodValidationPipe(TestSchema);
    expect(typeof pipe.transform).toBe("function");
  });
});
