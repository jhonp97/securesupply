// ─────────────────────────────────────────────
// RepositoriesModule — Módulo de repositorios
// Importa: PrismaModule (global), GitHubModule, ScanModule (global)
// Provee: RepositoriesService
// Controllers: RepositoriesController
// ─────────────────────────────────────────────

import { Module } from "@nestjs/common";
import { GitHubModule } from "../github/github.module";
import { RepositoriesService } from "./repositories.service";
import { RepositoriesController } from "./repositories.controller";
import { RepositoryOwnerGuard } from "../common/guards/repository-owner.guard";

@Module({
  imports: [GitHubModule],
  controllers: [RepositoriesController],
  providers: [RepositoriesService, RepositoryOwnerGuard],
  exports: [RepositoriesService],
})
export class RepositoriesModule {}
