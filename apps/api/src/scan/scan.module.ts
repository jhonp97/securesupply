// ─────────────────────────────────────────────
// ScanModule — Módulo de escaneo
// Provee la cola BullMQ y ScanQueueService
// para orquestar trabajos de escaneo.
// ─────────────────────────────────────────────

import { Module, Global } from "@nestjs/common";
import { Queue } from "bullmq";
import { RedisService } from "../redis/redis.service";
import { SCAN_QUEUE } from "../github/webhook.controller";
import { ScanQueueService } from "./scan-queue.service";

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
    ScanQueueService,
  ],
  exports: [SCAN_QUEUE, ScanQueueService],
})
export class ScanModule {}
