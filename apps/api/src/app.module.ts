// ─────────────────────────────────────────────
// Módulo principal — SecureSupply API
// Agrega módulos de la aplicación
// ─────────────────────────────────────────────

import { Module } from "@nestjs/common";
import { HealthModule } from "./health/health.module";
import { PrismaModule } from "./database/prisma.module";
import { RedisModule } from "./redis/redis.module";
import { AuthModule } from "./auth/auth.module";

@Module({
  imports: [HealthModule, PrismaModule, RedisModule, AuthModule],
})
export class AppModule {}
