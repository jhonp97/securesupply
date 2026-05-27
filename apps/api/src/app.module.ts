// ─────────────────────────────────────────────
// Módulo principal — SecureSupply API
// Agrega módulos de la aplicación
// ─────────────────────────────────────────────

import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { HealthModule } from "./health/health.module";
import { PrismaModule } from "./database/prisma.module";
import { AuthModule } from "./auth/auth.module";

@Module({
  imports: [HealthModule, PrismaModule, AuthModule],
  controllers: [AppController],
})
export class AppModule {}
