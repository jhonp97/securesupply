// ─────────────────────────────────────────────
// RedisService — Singleton de conexión Redis
// Usa ioredis para operaciones asíncronas
// Expone ping() para health checks
// ─────────────────────────────────────────────

import { Injectable, OnModuleDestroy, Logger } from "@nestjs/common";
import Redis from "ioredis";

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;

  constructor() {
    const url = process.env["REDIS_URL"] ?? "redis://localhost:6379";
    this.client = new Redis(url);

    this.client.on("error", (err: Error) => {
      this.logger.error("Error en conexión Redis: " + err.message);
    });
  }

  /**
   * Verifica conectividad con Redis mediante PING.
   * Retorna true si la respuesta es PONG.
   */
  async ping(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === "PONG";
    } catch {
      return false;
    }
  }

  /** Expone el cliente para casos avanzados (BullMQ, etc.) */
  getClient(): Redis {
    return this.client;
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }
}
