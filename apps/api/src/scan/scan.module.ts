// ─────────────────────────────────────────────
// ScanModule — Stub del módulo de escaneo
// Provee la cola BullMQ para encolar trabajos.
// La implementación completa del worker se
// realizará en PR #3 (Scan Job Orchestration).
// ─────────────────────────────────────────────

import { Module, Global } from "@nestjs/common";
import { Queue } from "bullmq";
import { RedisService } from "../redis/redis.service";
import { SCAN_QUEUE } from "../github/webhook.controller";

/** Nombre de la cola de escaneos en BullMQ */
const SCAN_QUEUE_NAME = "scan-jobs";

/**
 * Factory que crea la instancia de Queue para BullMQ.
 * Usa la conexión Redis existente del RedisService.
 */
function scanQueueFactory(redisService: RedisService): Queue {
  return new Queue(SCAN_QUEUE_NAME, {
    connection: redisService.getClient(),
    defaultJobOptions: {
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 5000 },
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
    },
  });
}

@Global()
@Module({
  providers: [
    {
      provide: SCAN_QUEUE,
      useFactory: scanQueueFactory,
      inject: [RedisService],
    },
  ],
  exports: [SCAN_QUEUE],
})
export class ScanModule {}
