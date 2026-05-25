// ─────────────────────────────────────────────
// Módulo de salud — SecureSupply API
// Proporciona endpoints de health check
// ─────────────────────────────────────────────

import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller";

@Module({
  controllers: [HealthController],
})
export class HealthModule {}
