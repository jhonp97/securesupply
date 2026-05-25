import { z } from "zod";

// ─────────────────────────────────────────────
// Esquema de validación de variables de entorno
// ─────────────────────────────────────────────

export const EnvSchema = z.object({
  // ── Base de datos ──
  DATABASE_URL: z.string().url("DATABASE_URL debe ser una URL válida"),

  // ── Redis ──
  REDIS_URL: z.string().url("REDIS_URL debe ser una URL válida"),

  // ── Aplicación ──
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),

  // ── JWT ──
  JWT_SECRET: z.string().min(32, "JWT_SECRET debe tener al menos 32 caracteres"),
  JWT_EXPIRES_IN: z.string().default("15m"),

  // ── GitHub ──
  GITHUB_APP_ID: z.string().optional(),
  GITHUB_PRIVATE_KEY: z.string().optional(),
  GITHUB_WEBHOOK_SECRET: z.string().optional(),

  // ── Logging ──
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info"),
});

export type Env = z.infer<typeof EnvSchema>;
