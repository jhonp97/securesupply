// ─────────────────────────────────────────────
// Módulo de base de datos — PrismaModule
// Provee PrismaService como singleton a toda la app
// ─────────────────────────────────────────────

import { Module, Global } from "@nestjs/common";
import { PrismaService } from "./prisma.service";

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
