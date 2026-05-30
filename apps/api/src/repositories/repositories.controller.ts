// ─────────────────────────────────────────────
// RepositoriesController — Endpoints de repos
// GET /repositories — listar (AuthGuard)
// POST /repositories — vincular (AuthGuard)
// GET /repositories/:id — detalle (AuthGuard + OwnerGuard)
// DELETE /repositories/:id — desconectar (AuthGuard + OwnerGuard)
// POST /repositories/:id/scan — escanear (AuthGuard + OwnerGuard)
// ─────────────────────────────────────────────

import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Req,
  HttpCode,
  HttpStatus,
  Inject,
  UseGuards,
  UsePipes,
} from "@nestjs/common";
import { RepositoriesService } from "./repositories.service";
import { AuthGuard } from "../auth/auth.guard";
import { RepositoryOwnerGuard } from "../common/guards/repository-owner.guard";
import { CreateRepoSchema, type CreateRepoDto } from "./dto/create-repo.dto";
import {
  TriggerScanSchema,
  type TriggerScanDto,
} from "./dto/trigger-scan.dto";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import type { Request } from "express";

@Controller("repositories")
@UseGuards(AuthGuard)
export class RepositoriesController {
  constructor(
    @Inject(RepositoriesService)
    private readonly repositoriesService: RepositoriesService,
  ) {}

  // ── GET /repositories ──
  @Get()
  async findAll(@Req() req: Request) {
    return this.repositoriesService.findAll(req.user.sub);
  }

  // ── POST /repositories ──
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ZodValidationPipe(CreateRepoSchema))
  async create(@Body() dto: CreateRepoDto, @Req() req: Request) {
    return this.repositoriesService.create(req.user.sub, dto);
  }

  // ── GET /repositories/:id ──
  @Get(":id")
  @UseGuards(RepositoryOwnerGuard)
  async findOne(@Param("id") id: string, @Req() req: Request) {
    return this.repositoriesService.findOne(req.user.sub, id);
  }

  // ── DELETE /repositories/:id ──
  @Delete(":id")
  @HttpCode(HttpStatus.OK)
  @UseGuards(RepositoryOwnerGuard)
  async remove(@Param("id") id: string, @Req() req: Request) {
    await this.repositoriesService.remove(req.user.sub, id);
    return { message: "Repositorio desconectado" };
  }

  // ── POST /repositories/:id/scan ──
  @Post(":id/scan")
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(RepositoryOwnerGuard)
  @UsePipes(new ZodValidationPipe(TriggerScanSchema))
  async triggerScan(
    @Param("id") id: string,
    @Body() dto: TriggerScanDto,
    @Req() req: Request,
  ) {
    return this.repositoriesService.triggerScan(req.user.sub, id, dto);
  }
}
