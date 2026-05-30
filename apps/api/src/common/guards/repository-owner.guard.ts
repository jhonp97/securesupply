// ─────────────────────────────────────────────
// RepositoryOwnerGuard — Verifica que el
// repositorio pertenezca al usuario autenticado
// Retorna 403 Forbidden si no es el owner
// ─────────────────────────────────────────────

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Inject,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";

@Injectable()
export class RepositoryOwnerGuard implements CanActivate {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user?.sub) {
      throw new UnauthorizedException("Usuario no autenticado");
    }

    const repoId = request.params?.id;

    if (!repoId) {
      throw new NotFoundException("ID de repositorio no proporcionado");
    }

    const repo = await this.prisma.repository.findUnique({
      where: { id: repoId },
    });

    if (!repo) {
      throw new NotFoundException("Repositorio no encontrado");
    }

    if (repo.ownerId !== user.sub) {
      throw new ForbiddenException(
        "No tenés permiso para acceder a este repositorio",
      );
    }

    return true;
  }
}
