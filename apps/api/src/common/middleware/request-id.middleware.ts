// ─────────────────────────────────────────────
// Request ID Middleware
// Asigna un UUID v4 como X-Request-ID a cada request
// Si el request ya trae un X-Request-ID, lo respeta
// ─────────────────────────────────────────────

import { Injectable, NestMiddleware } from "@nestjs/common";
import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "node:crypto";

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    // Respeta el header si ya viene del cliente
    const requestId = (req.headers["x-request-id"] as string) || randomUUID();

    // Lo asigna al request para que esté disponible en toda la cadena
    req.headers["x-request-id"] = requestId;

    // Lo envía en la respuesta
    res.setHeader("X-Request-ID", requestId);

    next();
  }
}
