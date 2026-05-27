import { EnvSchema, type Env } from "./env.schema.js";

// ─────────────────────────────────────────────
// Cargador de config validado con Zod
// Falla rápido si faltan variables obligatorias
// ─────────────────────────────────────────────

/**
 * Valida y tipa las variables de entorno.
 * Lanza un error descriptivo si la validación falla.
 */
export function loadEnv(): Env {
  const result = EnvSchema.safeParse(process.env);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");

    console.error(
      `\n❌ Error de configuración — variables de entorno inválidas:\n${issues}\n\n` +
        "Revisa tu archivo .env o las variables del entorno.",
    );
    process.exit(1);
  }

  return result.data;
}

export { EnvSchema } from "./env.schema.js";
export type { Env } from "./env.schema.js";
