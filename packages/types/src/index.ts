import { z } from "zod";

// ─────────────────────────────────────────────
// Schemas de dominio — SecureSupply
// ─────────────────────────────────────────────

// Estados posibles de un análisis de seguridad
export const ScanStatusEnum = z.enum(["PENDING", "RUNNING", "COMPLETED", "FAILED", "CANCELLED"]);
export type ScanStatus = z.infer<typeof ScanStatusEnum>;

// Nivel de riesgo
export const RiskLevelEnum = z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"]);
export type RiskLevel = z.infer<typeof RiskLevelEnum>;

// Repositorio a analizar
export const RepositorySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  url: z.string().url(),
  defaultBranch: z.string().default("main"),
  isActive: z.boolean().default(true),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Repository = z.infer<typeof RepositorySchema>;

// Hallazgo de seguridad
export const FindingSchema = z.object({
  id: z.string().uuid(),
  scanId: z.string().uuid(),
  repositoryId: z.string().uuid(),
  riskLevel: RiskLevelEnum,
  title: z.string().min(1).max(500),
  description: z.string(),
  filePath: z.string().optional(),
  lineNumber: z.number().int().nonnegative().optional(),
  packageName: z.string().optional(),
  vulnerableVersion: z.string().optional(),
  fixedVersion: z.string().optional(),
  createdAt: z.string().datetime(),
});
export type Finding = z.infer<typeof FindingSchema>;

// Análisis de seguridad (scan)
export const ScanSchema = z.object({
  id: z.string().uuid(),
  repositoryId: z.string().uuid(),
  status: ScanStatusEnum,
  commitSha: z.string().length(40).optional(),
  branch: z.string(),
  triggeredBy: z.string(),
  findingsCount: z.number().int().nonnegative().default(0),
  riskScore: z.number().min(0).max(100).optional(),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  errorMessage: z.string().optional(),
});
export type Scan = z.infer<typeof ScanSchema>;

// Usuario del sistema
export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string().min(1).max(255),
  avatarUrl: z.string().url().optional(),
  role: z.enum(["ADMIN", "MEMBER", "VIEWER"]).default("MEMBER"),
  isActive: z.boolean().default(true),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type User = z.infer<typeof UserSchema>;

// Webhook entrante
export const WebhookSchema = z.object({
  id: z.string().uuid(),
  repositoryId: z.string().uuid(),
  event: z.string(),
  payload: z.record(z.string(), z.unknown()),
  processed: z.boolean().default(false),
  receivedAt: z.string().datetime(),
});
export type Webhook = z.infer<typeof WebhookSchema>;

// Métrica de seguridad agregada
export const SecurityMetricSchema = z.object({
  id: z.string().uuid(),
  repositoryId: z.string().uuid(),
  totalFindings: z.number().int().nonnegative(),
  criticalCount: z.number().int().nonnegative(),
  highCount: z.number().int().nonnegative(),
  mediumCount: z.number().int().nonnegative(),
  lowCount: z.number().int().nonnegative(),
  infoCount: z.number().int().nonnegative(),
  riskScore: z.number().min(0).max(100),
  evaluatedAt: z.string().datetime(),
});
export type SecurityMetric = z.infer<typeof SecurityMetricSchema>;
