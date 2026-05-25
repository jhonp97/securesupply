// ─────────────────────────────────────────────
// Punto de entrada — SecureSupply Worker
// Inicializa NestJS como aplicación standalone (sin HTTP)
// Escucha colas de BullMQ para procesamiento asíncrono
// ─────────────────────────────────────────────

import { NestFactory } from "@nestjs/core";
import { Logger } from "@nestjs/common";
import { WorkerModule } from "./worker.module";

async function bootstrap() {
  const logger = new Logger("Bootstrap");

  const app = await NestFactory.createApplicationContext(WorkerModule, {
    logger: ["log", "error", "warn", "debug", "verbose"],
  });

  logger.log("Worker de SecureSupply iniciado");
  logger.log("Esperando trabajos en colas de BullMQ...");

  // Manejo de cierre graceful
  process.on("SIGTERM", async () => {
    logger.log("SIGTERM recibido — cerrando worker...");
    await app.close();
    process.exit(0);
  });

  process.on("SIGINT", async () => {
    logger.log("SIGINT recibido — cerrando worker...");
    await app.close();
    process.exit(0);
  });
}

bootstrap();
