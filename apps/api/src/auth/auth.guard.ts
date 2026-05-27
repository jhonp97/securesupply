// ─────────────────────────────────────────────
// AuthGuard — Guard de JWT para proteger rutas
// Extrae token Bearer del header Authorization,
// verifica firma con JWT_SECRET, y adjunta
// payload del usuario al request
// ─────────────────────────────────────────────

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Inject,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import * as jwt from "jsonwebtoken";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers?.["authorization"];

    if (!authHeader) {
      throw new UnauthorizedException("Token de autenticación requerido");
    }

    const parts = (authHeader as string).split(" ");

    if (parts.length !== 2 || parts[0] !== "Bearer") {
      throw new UnauthorizedException("Formato de token inválido");
    }

    const token = parts[1]!;
    const secret = process.env["JWT_SECRET"];

    if (!secret) {
      throw new UnauthorizedException("Error de configuración del servidor");
    }

    try {
      const payload = jwt.verify(token, secret);
      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException("Token inválido o expirado");
    }
  }
}
