// ─────────────────────────────────────────────
// HealthController — Endpoints de health check
// GET /health → estado completo del sistema
// GET /health/ready → readiness probe (Docker/K8s)
// ─────────────────────────────────────────────

import {
  Controller,
  Get,
  HttpStatus,
  Inject,
  Res,
} from "@nestjs/common";
import type { Response } from "express";
import { HealthService } from "./health.service";

@Controller("health")
export class HealthController {
  private readonly version: string;

  constructor(
    @Inject(HealthService) private readonly healthService: HealthService,
  ) {
    // Versión desde package.json (fallback a "0.1.0")
    this.version = process.env["npm_package_version"] ?? "0.1.0";
  }

  @Get()
  async check(
    @Res({ passthrough: true }) res: Response,
  ): Promise<Record<string, unknown>> {
    const [db, redis] = await Promise.all([
      this.healthService.checkDatabase(),
      this.healthService.checkRedis(),
    ]);

    const isHealthy = db.status === "ok" && redis.status === "ok";

    const response: Record<string, unknown> = {
      status: isHealthy ? "ok" : "degraded",
      db: { status: db.status, responseTimeMs: db.responseTimeMs },
      redis: { status: redis.status, responseTimeMs: redis.responseTimeMs },
      version: this.version,
      uptime: this.healthService.getUptime(),
    };

    if (!isHealthy) {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }

    return response;
  }

  @Get("ready")
  async ready(
    @Res({ passthrough: true }) res: Response,
  ): Promise<Record<string, unknown>> {
    const [db, redis] = await Promise.all([
      this.healthService.checkDatabase(),
      this.healthService.checkRedis(),
    ]);

    const isReady = db.status === "ok" && redis.status === "ok";

    const response: Record<string, unknown> = {
      ready: isReady,
    };

    if (!isReady) {
      response["details"] = {
        db: db.status,
        redis: redis.status,
      };
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }

    return response;
  }
}
