// ─────────────────────────────────────────────
// Punto de entrada — SecureSupply API
// Inicializa NestJS con Helmet, CORS y logger
// ─────────────────────────────────────────────

import { NestFactory } from "@nestjs/core";
import helmet from "helmet";
import { Logger } from "@nestjs/common";
import { AppModule } from "./app.module";

async function bootstrap() {
  const logger = new Logger("Bootstrap");

  const app = await NestFactory.create(AppModule, {
    logger: ["log", "error", "warn", "debug", "verbose"],
  });

  // ── Seguridad: Helmet protege contra vulnerabilidades web comunes ──
  app.use(helmet());

  // ── CORS: restringido al frontend configurado en FRONTEND_URL ──
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
  app.enableCors({
    origin: frontendUrl,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true,
  });

  const port = process.env.PORT || 4000;
  await app.listen(port);
  logger.log(`API iniciada en http://localhost:${port}`);
}

bootstrap();
