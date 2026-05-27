// ─────────────────────────────────────────────
// Utilidades compartidas — SecureSupply
// ─────────────────────────────────────────────

// ── Constantes del sistema ──

/** Nombre de la aplicación */
export const APP_NAME = "SecureSupply";

/** Versión actual */
export const APP_VERSION = "0.1.0";

/** Intervalo mínimo entre escaneos en milisegundos (72 horas) */
export const SCAN_COOLDOWN_MS = 72 * 60 * 60 * 1000;

/** Límite de solicitudes por minuto para rate limiting */
export const RATE_LIMIT_WINDOW_MS = 60 * 1000;
export const RATE_LIMIT_MAX_REQUESTS = 100;

/** Estados de escaneo que se consideran terminales */
export const TERMINAL_SCAN_STATUSES = ["COMPLETED", "FAILED", "CANCELLED"] as const;

// ── Utilidades ──

/**
 * Calcula el puntaje de riesgo basado en la cantidad de hallazgos
 * ponderados por su nivel de severidad.
 */
export function calculateRiskScore(
  criticalCount: number,
  highCount: number,
  mediumCount: number,
  lowCount: number,
): number {
  const weights = { critical: 10, high: 5, medium: 2, low: 1 };
  const raw =
    criticalCount * weights.critical +
    highCount * weights.high +
    mediumCount * weights.medium +
    lowCount * weights.low;

  // Normalizar a escala 0-100
  return Math.min(100, Math.round(raw));
}

/**
 * Valida que un path de repositorio no contenga caracteres peligrosos
 * (prevención de path traversal).
 */
export function isValidRepositoryPath(path: string): boolean {
  // Solo permite caracteres alfanuméricos, guiones, guiones bajos y slashes
  // Rechaza ".." y caracteres especiales peligrosos
  const SAFE_PATH_REGEX = /^[a-zA-Z0-9_.\-/]+$/;
  return SAFE_PATH_REGEX.test(path) && !path.includes("..");
}

/**
 * Formatea una fecha ISO como string legible en el locale del sistema.
 */
export function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString("es-AR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
