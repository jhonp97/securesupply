// ─────────────────────────────────────────────
// CreateRepoDto — Esquema Zod para crear
// un repositorio vinculado a GitHub
// Valida formato owner/repo y previene
// inyección de paths maliciosos
// ─────────────────────────────────────────────

import { z } from "zod";

/**
 * Regex para validar formato owner/repo de GitHub.
 * - Owner: 1-39 caracteres alfanuméricos o guiones
 * - Repo: 1-100 caracteres alfanuméricos, guiones, guiones bajos o puntos
 * - Exactamente un slash separando ambos
 */
const GITHUB_FULL_NAME_REGEX = /^[a-zA-Z0-9](?:[a-zA-Z0-9_-]{0,38}[a-zA-Z0-9])?\/[a-zA-Z0-9._-]{1,100}$/;

/**
 * Regex para detectar path traversal y caracteres peligrosos.
 * Rechaza "..", caracteres de shell, y secuencias de inyección.
 */
const PELIGROSO_REGEX = /[;|&$`<>"'\\]|\.\.[/\\]/;

export const CreateRepoSchema = z.object({
  fullName: z
    .string()
    .min(1, "fullName es obligatorio")
    .regex(
      GITHUB_FULL_NAME_REGEX,
      "fullName debe tener formato 'owner/repo' con caracteres válidos de GitHub",
    )
    .refine(
      (val) => !PELIGROSO_REGEX.test(val),
      "fullName contiene caracteres no permitidos",
    ),
});

export type CreateRepoDto = z.infer<typeof CreateRepoSchema>;
