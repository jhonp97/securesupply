// ─────────────────────────────────────────────
// Configuración de Next.js 16 — SecureSupply Web
// ─────────────────────────────────────────────

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Turbopack está habilitado por defecto en Next.js 16
  // No se necesita flag --turbopack en el script dev

  // Cabeceras de seguridad básicas
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
