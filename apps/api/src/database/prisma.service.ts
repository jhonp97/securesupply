// ─────────────────────────────────────────────
// PrismaService — Singleton de PrismaClient
// Gestiona el ciclo de vida de la conexión a PostgreSQL
// Usa @prisma/adapter-pg para el driver adaptador nativo
// ─────────────────────────────────────────────

import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const pool = new Pool({ connectionString: process.env["DATABASE_URL"] });
    const adapter = new PrismaPg(pool);
    super({ adapter });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
