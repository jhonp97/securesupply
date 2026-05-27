// ─────────────────────────────────────────────
// Filtro global de excepciones
// Atrapa todas las excepciones no manejadas y
// devuelve una respuesta estructurada:
// { statusCode, message, requestId, timestamp }
// En producción NO incluye el stack trace.
// ─────────────────────────────────────────────

import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import type { Request, Response } from "express";

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const requestId =
      (request.headers["x-request-id"] as string) ?? "unknown";

    const errorResponse: Record<string, unknown> = {
      statusCode,
      message:
        exception instanceof HttpException
          ? exception.message
          : "Error interno del servidor",
      requestId,
      timestamp: new Date().toISOString(),
    };

    // En producción no exponemos el stack trace
    if (process.env["NODE_ENV"] !== "production") {
      errorResponse["stack"] =
        exception instanceof Error ? exception.stack : undefined;
    }

    response.status(statusCode).json(errorResponse);
  }
}
