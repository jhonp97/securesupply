import { z } from "zod";

// ─────────────────────────────────────────────
// Esquema de validación de variables de entorno
// ─────────────────────────────────────────────

/**
 * Valida que un string contenga una clave privada en formato PEM.
 * Acepta PKCS#1, PKCS#8 y EC keys.
 */
function esPemValido(valor: string): boolean {
  return (
    typeof valor === "string" &&
    valor.startsWith("-----BEGIN ") &&
    valor.includes("-----END ") &&
    valor.includes("PRIVATE KEY")
  );
}

export const EnvSchema = z.object({
  // ── Base de datos ──
  DATABASE_URL: z.string().url("DATABASE_URL debe ser una URL válida"),

  // ── Redis ──
  REDIS_URL: z.string().url("REDIS_URL debe ser una URL válida"),

  // ── JWT ──
  JWT_SECRET: z.string().min(32, "JWT_SECRET debe tener al menos 32 caracteres"),
  REFRESH_TOKEN_SECRET: z
    .string()
    .min(32, "REFRESH_TOKEN_SECRET debe tener al menos 32 caracteres"),

  // ── GitHub App ──
  GITHUB_APP_ID: z.string().min(1, "GITHUB_APP_ID es obligatorio"),
  GITHUB_APP_PRIVATE_KEY: z
    .string()
    .refine(esPemValido, "GITHUB_APP_PRIVATE_KEY debe ser una clave privada válida en formato PEM"),
  GITHUB_WEBHOOK_SECRET: z
    .string()
    .min(20, "GITHUB_WEBHOOK_SECRET debe tener al menos 20 caracteres"),

  // ── Aplicación ──
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  FRONTEND_URL: z.string().url().default("http://localhost:3000"),

  // ── Scanner / Worker ──
  SCANNER_TIMEOUT_MS: z.coerce.number().positive().default(300000),
  MAX_REPO_SIZE_MB: z.coerce.number().positive().default(500),
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(8).default(2),

  // ── Logging ──
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info"),
});

export type Env = z.infer<typeof EnvSchema>;
