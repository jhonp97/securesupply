// ─────────────────────────────────────────────
// Endpoint de salud — SecureSupply Web
// Responde con el estado actual del frontend
// ─────────────────────────────────────────────

import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      app: "SecureSupply Web",
      timestamp: new Date().toISOString(),
    },
    { status: 200 },
  );
}
