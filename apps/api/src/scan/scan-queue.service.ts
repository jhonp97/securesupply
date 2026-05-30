// ─────────────────────────────────────────────
// ScanQueueService — Orquestación de escaneos
// Centraliza la lógica de encolar escaneos:
//   1. Verifica lock concurrente (transacción)
//   2. Crea ScanJob en BD
//   3. Encola en BullMQ
//   4. Actualiza cache Redis (best-effort)
// ─────────────────────────────────────────────

import {
  Injectable,
  Inject,
  ConflictException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { RedisService } from "../redis/redis.service";
import { SCAN_QUEUE } from "../github/webhook.controller";
import type { Queue } from "bullmq";
import type { TriggerType } from "@prisma/client";

/** Estados de escaneo que impiden lanzar otro en paralelo */
const ESTADOS_ACTIVOS = ["QUEUED", "CLONING", "SCANNING"] as const;

@Injectable()
export class ScanQueueService {
  private readonly logger = new Logger(ScanQueueService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(SCAN_QUEUE) private readonly scanQueue: Queue,
    @Inject(RedisService) private readonly redisService: RedisService,
  ) {}

  /**
   * Encola un nuevo escaneo para un repositorio.
   *
   * Flujo atómico (transacción Prisma):
   *   1. Verifica que no haya un escaneo activo (lock concurrente)
   *   2. Crea el ScanJob en BD con status QUEUED
   *
   * Luego (fuera de la transacción):
   *   3. Encola el trabajo en BullMQ
   *   4. Actualiza cache Redis (best-effort, no bloquea)
   *
   * @param repositoryId - ID del repositorio a escanear
   * @param triggerType - Tipo de disparador (WEBHOOK, MANUAL, SCHEDULED)
   * @param gitRef - Rama o referencia git a escanear
   * @returns Objeto con scanJobId del trabajo creado
   * @throws ConflictException si ya hay un escaneo activo para el repositorio
   */
  async enqueueScan(
    repositoryId: string,
    triggerType: TriggerType,
    gitRef: string,
  ): Promise<{ scanJobId: string }> {
    // ── Paso 1+2: Transacción atómica (lock + create) ──
    const scanJob = await this.prisma.$transaction(async (tx) => {
      // Verificar lock concurrente
      const activeScan = await tx.scanJob.findFirst({
        where: {
          repositoryId,
          status: { in: [...ESTADOS_ACTIVOS] },
        },
      });

      if (activeScan) {
        throw new ConflictException(
          `Ya hay un escaneo activo (${activeScan.status}) para este repositorio`,
        );
      }

      // Crear ScanJob en BD
      return tx.scanJob.create({
        data: {
          repositoryId,
          triggerType,
          gitRef,
          status: "QUEUED",
        },
      });
    });

    // ── Paso 3: Encolar en BullMQ ──
    await this.scanQueue.add("scan", {
      scanJobId: scanJob.id,
      repositoryId,
      gitRef,
    });

    this.logger.log(
      `Escaneo encolado: scanJob=${scanJob.id}, repo=${repositoryId}, ref=${gitRef}`,
    );

    // ── Paso 4: Actualizar cache Redis (best-effort) ──
    try {
      const redis = this.redisService.getClient();
      await redis.set(`scan:${scanJob.id}:status`, scanJob.status);
    } catch (error) {
      this.logger.warn(
        `No se pudo actualizar cache Redis para scanJob ${scanJob.id}: ` +
          `${error instanceof Error ? error.message : "error desconocido"}`,
      );
    }

    return { scanJobId: scanJob.id };
  }

  /**
   * Retorna métricas de la cola de escaneos.
   * Útil para monitoreo y dashboards de operación.
   *
   * @returns Conteos de trabajos waiting, active y completed
   */
  async getQueueStatus(): Promise<{
    waiting: number;
    active: number;
    completed: number;
  }> {
    const [waiting, active, completed] = await Promise.all([
      this.scanQueue.getWaitingCount(),
      this.scanQueue.getActiveCount(),
      this.scanQueue.getCompletedCount(),
    ]);

    return { waiting, active, completed };
  }
}
