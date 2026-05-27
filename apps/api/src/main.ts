// ─────────────────────────────────────────────
// Punto de entrada — SecureSupply API
// Inicializa NestJS con:
//   - Helmet (CSP + HSTS)
//   - CORS restringido a FRONTEND_URL
//   - Pino logger con redacción de campos sensibles
//   - Middleware de Request ID (UUID v4)
//   - Filtro global de excepciones
//   - Swagger UI en /api/docs
// ─────────────────────────────────────────────

import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { Logger, RequestMethod } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import helmet from "helmet";
import pinoHttp from "pino-http";
import pino from "pino";
import cookieParser from "cookie-parser";
import { RequestIdMiddleware } from "./common/middleware/request-id.middleware";
import { GlobalExceptionFilter } from "./common/filters/global-exception.filter";

async function bootstrap() {
  const logger = new Logger("Bootstrap");

  // ── Configurar Pino con redacción de campos sensibles ──
  const pinoLogger = pino({
    redact: {
      paths: [
        "*.token",
        "*.secret",
        "*.password",
        "*.privateKey",
        "*.installationToken",
        "*.accessToken",
        "*.refreshToken",
        "req.headers.authorization",
        "req.headers.cookie",
      ],
      censor: "[REDACTED]",
    },
  });

  const app = await NestFactory.create(AppModule, {
    logger: ["log", "error", "warn", "debug", "verbose"],
  });

  // ── Seguridad: Helmet con protección avanzada ──
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "validator.swagger.io"],
        },
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
    }),
  );

  // ── CORS: restringido al frontend configurado ──
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
  app.enableCors({
    origin: frontendUrl,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-request-id"],
    exposedHeaders: ["x-request-id"],
    credentials: true,
    maxAge: 86400,
  });

  // ── Cookie parser para leer refresh_token ──
  app.use(cookieParser());

  // ── Logger HTTP con redacción ──
  app.use(
    pinoHttp({
      logger: pinoLogger,
      autoLogging: {
        ignore: (req) => req.url === "/health" || req.url === "/api/docs",
      },
    }),
  );

  // ── Request ID Middleware ──
  app.use(new RequestIdMiddleware().use);

  // ── Filtro global de excepciones ──
  app.useGlobalFilters(new GlobalExceptionFilter());

  // ── Swagger ──
  const swaggerConfig = new DocumentBuilder()
    .setTitle("SecureSupply API")
    .setDescription("API de análisis de seguridad en cadena de suministro")
    .setVersion("0.1.0")
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("api/docs", app, document);

  // ── Prefijo global ──
  app.setGlobalPrefix("api", {
    exclude: [{ path: "health", method: RequestMethod.GET }],
  });

  const port = process.env.PORT || 4000;
  await app.listen(port);
  logger.log(`API iniciada en http://localhost:${port}`);
  logger.log(`Documentación Swagger en http://localhost:${port}/api/docs`);
}

bootstrap();
