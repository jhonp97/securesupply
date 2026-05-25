// ─────────────────────────────────────────────
// Layout raíz — SecureSupply Web
// Define la estructura HTML base para todas las rutas
// ─────────────────────────────────────────────

import type { Metadata } from "next";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: "SecureSupply",
  description: "Plataforma de análisis de seguridad en cadena de suministro",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
