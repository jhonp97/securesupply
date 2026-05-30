// ─────────────────────────────────────────────
// RepositoriesService — Gestión de repositorios
// findAll, create, findOne, remove, triggerScan
// Incluye: anti-SSRF, ownership check,
//          lock de escaneo concurrente
// ─────────────────────────────────────────────

import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { GitHubService } from "../github/github.service";
import { validateGitHubUrl } from "@securesupply/shared";
import { SCAN_QUEUE } from "../github/webhook.controller";
import type { CreateRepoDto } from "./dto/create-repo.dto";
import type { TriggerScanDto } from "./dto/trigger-scan.dto";
import type { Queue } from "bullmq";

/** Estados de escaneo que impiden lanzar otro en paralelo */
const ESTADOS_ACTIVOS = ["QUEUED", "CLONING", "SCANNING"] as const;

/** Cantidad máxima de repos por página en listados */
const PAGE_SIZE = 20;

@Injectable()
export class RepositoriesService {
  private readonly logger = new Logger(RepositoriesService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(GitHubService) private readonly githubService: GitHubService,
    @Inject(SCAN_QUEUE) private readonly scanQueue: Queue,
  ) {}

  // ── Listar repositorios del usuario (paginado) ──
  async findAll(
    userId: string,
    page: number = 1,
  ): Promise<{ data: unknown[]; total: number; page: number }> {
    const skip = (page - 1) * PAGE_SIZE;

    const [data, total] = await Promise.all([
      this.prisma.repository.findMany({
        where: { ownerId: userId },
        include: {
          scanJobs: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { id: true, status: true, createdAt: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: PAGE_SIZE,
      }),
      this.prisma.repository.count({
        where: { ownerId: userId },
      }),
    ]);

    return { data, total, page };
  }

  // ── Crear (vincular) repositorio ──
  async create(userId: string, dto: CreateRepoDto) {
    // Validar anti-SSRF: construir URL y verificar
    const repoUrl = `https://github.com/${dto.fullName}`;

    if (!validateGitHubUrl(repoUrl)) {
      throw new ConflictException(
        "URL del repositorio no pasa la validación de seguridad",
      );
    }

    // Verificar que no exista ya
    const existing = await this.prisma.repository.findUnique({
      where: { fullName: dto.fullName },
    });

    if (existing) {
      throw new ConflictException(
        `El repositorio ${dto.fullName} ya está vinculado`,
      );
    }

    // Extraer owner y nombre del repo
    const [owner, repo] = dto.fullName.split("/");

    // Crear registro en BD
    const repository = await this.prisma.repository.create({
      data: {
        fullName: dto.fullName,
        defaultBranch: "main",
        isPrivate: false,
        ownerId: userId,
        // githubId e installationId se completarán vía webhook
        githubId: 0,
      },
    });

    this.logger.log(
      `Repositorio vinculado: ${dto.fullName} por usuario ${userId}`,
    );

    return repository;
  }

  // ── Obtener un repositorio con último escaneo ──
  async findOne(userId: string, id: string) {
    const repo = await this.prisma.repository.findUnique({
      where: { id },
      include: {
        scanJobs: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: {
            result: {
              include: {
                findings: {
                  orderBy: { severity: "desc" },
                },
              },
            },
          },
        },
      },
    });

    if (!repo) {
      throw new NotFoundException("Repositorio no encontrado");
    }

    if (repo.ownerId !== userId) {
      throw new ForbiddenException(
        "No tenés permiso para acceder a este repositorio",
      );
    }

    return repo;
  }

  // ── Desconectar (eliminar) repositorio ──
  async remove(userId: string, id: string): Promise<void> {
    const repo = await this.prisma.repository.findUnique({
      where: { id },
    });

    if (!repo) {
      throw new NotFoundException("Repositorio no encontrado");
    }

    if (repo.ownerId !== userId) {
      throw new ForbiddenException(
        "No tenés permiso para eliminar este repositorio",
      );
    }

    // Eliminación en cascada: borra ScanJobs, ScanResults y Findings
    await this.prisma.repository.delete({
      where: { id },
    });

    this.logger.log(
      `Repositorio desconectado: ${repo.fullName} por usuario ${userId}`,
    );
  }

  // ── Disparar escaneo manual ──
  async triggerScan(userId: string, id: string, dto: TriggerScanDto) {
    // Verificar existencia y ownership
    const repo = await this.prisma.repository.findUnique({
      where: { id },
    });

    if (!repo) {
      throw new NotFoundException("Repositorio no encontrado");
    }

    if (repo.ownerId !== userId) {
      throw new ForbiddenException(
        "No tenés permiso para escanear este repositorio",
      );
    }

    // Verificar lock de escaneo concurrente
    const activeScan = await this.prisma.scanJob.findFirst({
      where: {
        repositoryId: id,
        status: { in: [...ESTADOS_ACTIVOS] },
      },
    });

    if (activeScan) {
      throw new ConflictException(
        `Ya hay un escaneo activo (${activeScan.status}) para este repositorio`,
      );
    }

    // Crear ScanJob en BD
    const scanJob = await this.prisma.scanJob.create({
      data: {
        repositoryId: id,
        triggerType: "MANUAL",
        gitRef: dto.gitRef,
        status: "QUEUED",
      },
    });

    // Encolar en BullMQ
    await this.scanQueue.add("scan", {
      scanJobId: scanJob.id,
      repositoryId: id,
      gitRef: dto.gitRef,
      installationId: repo.installationId,
    });

    this.logger.log(
      `Escaneo manual encolado para ${repo.fullName}@${dto.gitRef} (scanJob: ${scanJob.id})`,
    );

    return scanJob;
  }
}
