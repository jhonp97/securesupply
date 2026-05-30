// ─────────────────────────────────────────────
// WebhookPayloadDto — Esquema Zod para payload
// de webhooks de GitHub (push y pull_request)
// ─────────────────────────────────────────────

import { z } from "zod";

// ── Esquema del repositorio en el webhook ──
const RepositorySchema = z.object({
  id: z.number().int().positive("ID de repositorio inválido"),
  full_name: z.string().min(1, "full_name es obligatorio"),
  default_branch: z.string().min(1, "default_branch es obligatorio"),
  private: z.boolean(),
});

// ── Esquema de la instalación ──
const InstallationSchema = z.object({
  id: z.number().int().positive("ID de instalación inválido"),
});

// ── Esquema principal del payload ──
export const WebhookPayloadSchema = z.object({
  ref: z.string().min(1, "ref es obligatorio"),
  repository: RepositorySchema,
  installation: InstallationSchema,
});

export type WebhookPayload = z.infer<typeof WebhookPayloadSchema>;
