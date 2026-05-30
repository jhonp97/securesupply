// ─────────────────────────────────────────────
// WebhookController — Endpoint de webhooks GitHub
// POST /webhooks/github
// Verifica firma HMAC, valida payload con Zod,
// crea repositorio si es nuevo, encola escaneo
// ─────────────────────────────────────────────

import {
  Controller,
  Post,
  Req,
  HttpCode,
  HttpStatus,
  Inject,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { Webhooks } from "@octokit/webhooks";
import { PrismaService } from "../database/prisma.service";
import { GitHubService } from "./github.service";
import { WebhookPayloadSchema } from "./dto/webhook-payload.dto";
import type { Request } from "express";
import type { Queue } from "bullmq";

/** Token de inyección para la cola de escaneos */
export const SCAN_QUEUE = "SCAN_QUEUE";

/** Eventos de GitHub que disparan un escaneo */
const ESCANEABLE_EVENTS = new Set(["push", "pull_request"]);

@Controller("webhooks")
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);
  private readonly webhooks: Webhooks;

  constructor(
    @Inject(GitHubService) private readonly githubService: GitHubService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(SCAN_QUEUE) private readonly scanQueue: Queue,
  ) {
    const secret = process.env["GITHUB_WEBHOOK_SECRET"];
    if (!secret) {
      throw new Error("GITHUB_WEBHOOK_SECRET es obligatorio");
    }
    this.webhooks = new Webhooks({ secret });
  }

  @Post("github")
  @HttpCode(HttpStatus.OK)
  async handleWebhook(@Req() req: Request): Promise<{ message: string }> {
    const event = req.headers["x-github-event"] as string;
    const delivery = req.headers["x-github-delivery"] as string;
    const signature = req.headers["x-hub-signature-256"] as string;

    // ── Verificar que los headers requeridos estén presentes ──
    if (!signature || !event || !delivery) {
      this.logger.warn(
        `Webhook recibido sin headers requeridos (delivery: ${delivery})`,
      );
      throw new UnauthorizedException("Firma de webhook requerida");
    }

    // ── Verificación HMAC de la firma ──
    const rawBody = (req as any).rawBody as Buffer;

    if (!rawBody) {
      throw new BadRequestException("Body del webhook vacío");
    }

    const isValid = await this.webhooks.verify(
      rawBody.toString("utf-8"),
      signature,
    );

    if (!isValid) {
      this.logger.error(
        `Firma HMAC inválida para delivery ${delivery}`,
      );
      throw new UnauthorizedException("Firma de webhook inválida");
    }

    // ── Eventos no escaneables → ignorar ──
    if (!ESCANEABLE_EVENTS.has(event)) {
      this.logger.debug(`Evento "${event}" ignorado (delivery: ${delivery})`);
      return { message: "Evento ignorado" };
    }

    // ── Parsear y validar payload con Zod ──
    let payload: ReturnType<typeof JSON.parse>;
    try {
      payload = JSON.parse(rawBody.toString("utf-8"));
    } catch {
      throw new BadRequestException("Payload JSON malformado");
    }

    const parseResult = WebhookPayloadSchema.safeParse(payload);

    if (!parseResult.success) {
      this.logger.warn(
        `Payload de webhook inválido (delivery: ${delivery}): ${parseResult.error.message}`,
      );
      throw new BadRequestException("Payload del webhook inválido");
    }

    const { repository, installation, ref } = parseResult.data;

    // ── Buscar repositorio en BD por ID de GitHub ──
    // Si no existe, el repo aún no fue vinculado por ningún usuario.
    // Se registra la instalación y se ignora el evento hasta que
    // un usuario lo vincule manualmente desde el dashboard.
    let repo = await this.prisma.repository.findUnique({
      where: { githubId: repository.id },
    });

    if (!repo) {
      // Verificar si existe por fullName y actualizar installationId
      repo = await this.prisma.repository.findUnique({
        where: { fullName: repository.full_name },
      });

      if (repo) {
        // Actualizar installationId si cambió
        await this.prisma.repository.update({
          where: { id: repo.id },
          data: { installationId: installation.id },
        });
      } else {
        this.logger.log(
          `Webhook recibido para repo no vinculado: ${repository.full_name}. ` +
            `Se ignorará hasta que un usuario lo vincule.`,
        );
        return { message: "Repositorio no vinculado, evento registrado" };
      }
    }

    // ── Extraer rama del ref (refs/heads/main → main) ──
    const gitRef = ref.replace(/^refs\/heads\//, "");

    // ── Crear ScanJob en BD ──
    const scanJob = await this.prisma.scanJob.create({
      data: {
        repositoryId: repo.id,
        triggerType: "WEBHOOK",
        gitRef,
        status: "QUEUED",
      },
    });

    // ── Encolar trabajo en BullMQ ──
    await this.scanQueue.add("scan", {
      scanJobId: scanJob.id,
      repositoryId: repo.id,
      gitRef,
      installationId: installation.id,
    });

    this.logger.log(
      `Escaneo encolado para ${repository.full_name}@${gitRef} (scanJob: ${scanJob.id})`,
    );

    return { message: "Webhook procesado, escaneo encolado" };
  }
}
