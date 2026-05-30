// ─────────────────────────────────────────────
// TriggerScanDto — Esquema Zod para disparar
// un escaneo de seguridad en un repositorio
// gitRef es opcional, default 'main'
// ─────────────────────────────────────────────

import { z } from "zod";

/**
 * Regex para validar un gitRef seguro.
 * Permite nombres de rama, tags y refs completas.
 * Rechaza path traversal, caracteres de shell y espacios.
 */
const SAFE_GIT_REF_REGEX = /^[a-zA-Z0-9._/\-@]+$/;

export const TriggerScanSchema = z.object({
  gitRef: z
    .string()
    .min(1, "gitRef no puede estar vacío")
    .regex(SAFE_GIT_REF_REGEX, "gitRef contiene caracteres no permitidos")
    .refine(
      (val) => !val.includes(".."),
      "gitRef no puede contener path traversal",
    )
    .default("main"),
});

export type TriggerScanDto = z.infer<typeof TriggerScanSchema>;
