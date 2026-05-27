// ─────────────────────────────────────────────
// HealthService — Verificación de estado del sistema
// Verifica conectividad con DB (PostgreSQL) y Redis
// Expone métricas de uptime y profundidad de cola
// ─────────────────────────────────────────────

import { Injectable, Inject } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { RedisService } from "../redis/redis.service";

export interface HealthCheckResult {
  status: "ok" | "fail";
  responseTimeMs: number;
}

@Injectable()
export class HealthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RedisService) private readonly redis: RedisService,
  ) {}

  /**
   * Verifica conectividad con PostgreSQL mediante SELECT 1.
   * Mide el tiempo de respuesta en milisegundos.
   */
  async checkDatabase(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: "ok", responseTimeMs: Date.now() - start };
    } catch {
      return { status: "fail", responseTimeMs: Date.now() - start };
    }
  }

  /**
   * Verifica conectividad con Redis mediante PING.
   * Mide el tiempo de respuesta en milisegundos.
   */
  async checkRedis(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
      const pong = await this.redis.ping();
      return {
        status: pong ? "ok" : "fail",
        responseTimeMs: Date.now() - start,
      };
    } catch {
      return { status: "fail", responseTimeMs: Date.now() - start };
    }
  }

  /**
   * Scaffold para profundidad de cola BullMQ.
   * Retorna null hasta que BullMQ se implemente en Phase 4.
   */
  getQueueDepth(): null {
    return null;
  }

  /**
   * Tiempo de actividad del proceso en segundos.
   */
  getUptime(): number {
    return process.uptime();
  }
}
