// ─────────────────────────────────────────────
// Módulo del Worker — SecureSupply
// Configura BullMQ para procesamiento de colas
// ─────────────────────────────────────────────

import { Module, OnModuleInit, Logger } from "@nestjs/common";

@Module({})
export class WorkerModule implements OnModuleInit {
  private readonly logger = new Logger(WorkerModule.name);

  onModuleInit() {
    this.logger.log("WorkerModule inicializado — BullMQ listeners listos");
    // TODO: Registrar workers de BullMQ:
    //   new Worker('queue-name', processor, { connection })
    //   Ver apps/worker/src/workers/ para procesadores
  }
}
