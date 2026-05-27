// ─────────────────────────────────────────────
// RedisModule — Módulo de conexión Redis
// Provee RedisService como singleton a toda la app
// ─────────────────────────────────────────────

import { Module, Global } from "@nestjs/common";
import { RedisService } from "./redis.service";

@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
