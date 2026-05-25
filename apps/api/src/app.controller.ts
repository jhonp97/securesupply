// ─────────────────────────────────────────────
// Controlador principal — SecureSupply API
// Endpoints de verificación del sistema
// ─────────────────────────────────────────────

import { Controller, Get } from "@nestjs/common";

@Controller()
export class AppController {
  @Get("health")
  getHealth() {
    return {
      status: "ok",
      app: "SecureSupply API",
      timestamp: new Date().toISOString(),
    };
  }
}
