// ─────────────────────────────────────────────
// AuthModule — Módulo de autenticación
// Importa JwtModule con configuración desde env
// Provee AuthService y exporta AuthGuard
// ─────────────────────────────────────────────

import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { AuthGuard } from "./auth.guard";

@Module({
  imports: [
    JwtModule.register({
      secret: process.env["JWT_SECRET"] || "fallback-secret-do-not-use-in-prod",
      signOptions: { expiresIn: "1h" },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthGuard],
  exports: [AuthGuard],
})
export class AuthModule {}
