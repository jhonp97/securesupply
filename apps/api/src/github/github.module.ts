// ─────────────────────────────────────────────
// GitHubModule — Módulo de integración con GitHub
// Provee GitHubService y WebhookController
// Exporta GitHubService para uso en RepositoryModule
// ─────────────────────────────────────────────

import { Module } from "@nestjs/common";
import { GitHubService } from "./github.service";
import { WebhookController } from "./webhook.controller";

@Module({
  controllers: [WebhookController],
  providers: [GitHubService],
  exports: [GitHubService],
})
export class GitHubModule {}
