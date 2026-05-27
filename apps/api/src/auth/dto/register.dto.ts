// ─────────────────────────────────────────────
// RegisterDto — Esquema Zod para registro
// ─────────────────────────────────────────────

import { z } from "zod";

export const RegisterSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres")
    .max(100, "La contraseña no puede exceder 100 caracteres"),
});

export type RegisterDto = z.infer<typeof RegisterSchema>;
