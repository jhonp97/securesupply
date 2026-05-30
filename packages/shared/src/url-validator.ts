// ─────────────────────────────────────────────
// Validador de URLs de GitHub — Anti-SSRF
// ─────────────────────────────────────────────
// Valida que una URL sea un enlace HTTPS legítimo
// a github.com, rechazando IPs privadas, localhost
// y esquemas peligrosos (file://, ssh://, etc.)
// ─────────────────────────────────────────────

/** Dominio permitido para URLs de GitHub */
const ALLOWED_HOSTNAME = "github.com";

/**
 * Rangos de IPs privadas que deben rechazarse para prevenir SSRF.
 * Incluye: loopback, redes privadas RFC 1918, y localhost.
 */
const PRIVATE_IP_PATTERNS: RegExp[] = [
  /^127\./,            // loopback
  /^10\./,             // clase A privada
  /^172\.(1[6-9]|2\d|3[01])\./, // clase B privada (172.16.0.0 – 172.31.255.255)
  /^192\.168\./,       // clase C privada
  /^0\./,              // red actual
  /^169\.254\./,       // link-local
];

/** Hostnames que siempre se rechazan */
const BLOCKED_HOSTNAMES: string[] = ["localhost"];

/**
 * Valida que una URL sea un enlace HTTPS legítimo a github.com.
 *
 * Rechaza:
 * - Protocolos distintos a HTTPS (HTTP, file://, ssh://, etc.)
 * - Hostnames que no sean exactamente "github.com"
 * - IPs privadas y localhost (prevención de SSRF)
 * - Strings vacíos o URLs malformadas
 *
 * @param url - La URL a validar
 * @returns `true` si la URL es HTTPS y apunta a github.com, `false` en caso contrario
 */
export function validateGitHubUrl(url: string): boolean {
  // Rechazar strings vacíos inmediatamente
  if (!url) {
    return false;
  }

  // Detectar intentos de path traversal en la URL cruda ANTES de parsear.
  // El constructor URL normaliza "/../" eliminándolo, por lo que debemos
  // verificar el string original para detectar la intención maliciosa.
  if (url.includes("/../") || url.includes("/..") || url.includes("..%2F")) {
    return false;
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    // URL malformada — no es válida
    return false;
  }

  // Solo permitir HTTPS
  if (parsed.protocol !== "https:") {
    return false;
  }

  const hostname = parsed.hostname;

  // Rechazar localhost
  if (BLOCKED_HOSTNAMES.includes(hostname)) {
    return false;
  }

  // Rechazar IPs privadas
  for (const pattern of PRIVATE_IP_PATTERNS) {
    if (pattern.test(hostname)) {
      return false;
    }
  }

  // Solo permitir exactamente "github.com" (no subdominios)
  if (hostname !== ALLOWED_HOSTNAME) {
    return false;
  }

  return true;
}
