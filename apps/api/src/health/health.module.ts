// ─────────────────────────────────────────────
// Módulo de salud — HealthModule
// Proporciona endpoints de health check
// Depende de DatabaseModule y RedisModule
// ─────────────────────────────────────────────

import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller";
import { HealthService } from "./health.service";
import { PrismaModule } from "../database/prisma.module";
import { RedisModule } from "../redis/redis.module";

@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
