// ─────────────────────────────────────────────
// ZodValidationPipe — Pipe de validación genérico
// para esquemas Zod en NestJS
// ─────────────────────────────────────────────

import {
  PipeTransform,
  Injectable,
  BadRequestException,
} from "@nestjs/common";
import { ZodSchema } from "zod";

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  transform(value: unknown): unknown {
    const result = this.schema.safeParse(value);

    if (!result.success) {
    const issues = result.error.issues.map((err) => ({
      field: err.path.join("."),
      message: err.message,
    }));

    throw new BadRequestException({
      message: "Error de validación",
      errors: issues,
    });
    }

    return result.data;
  }
}
