// ─────────────────────────────────────────────
// Controlador de salud — módulo Health
// Endpoint dedicado para health checks
// ─────────────────────────────────────────────

import { Controller, Get } from "@nestjs/common";

@Controller("health")
export class HealthController {
  @Get()
  check() {
    return {
      status: "ok",
      app: "SecureSupply API",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }
}
