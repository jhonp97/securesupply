// ─────────────────────────────────────────────
// AuthService — Lógica principal de autenticación
// Register, Login, Refresh, Logout
// Incluye detección de reuse attack
// ─────────────────────────────────────────────

import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import * as crypto from "node:crypto";
import { PrismaService } from "../database/prisma.service";
import type { RegisterDto } from "./dto/register.dto";
import type { LoginDto } from "./dto/login.dto";
import type { Response } from "express";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  // ── Registro de usuario ─────────────────────
  async register(dto: RegisterDto): Promise<void> {
    // Verificar unicidad del email
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException("Email ya registrado");
    }

    // Hash de la contraseña con bcrypt (cost factor 12)
    const passwordHash = await bcrypt.hash(dto.password, 12);

    // Crear usuario en BD
    await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
      },
    });

    // Retorna void → 201 Created
  }

  // ── Inicio de sesión ────────────────────────
  async login(
    dto: LoginDto,
    res: Response,
  ): Promise<{ accessToken: string }> {
    // Buscar usuario por email
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    // Mensaje genérico para evitar enumeración de usuarios
    const invalidMessage = "Credenciales inválidas";

    if (!user) {
      throw new UnauthorizedException(invalidMessage);
    }

    // Verificar contraseña
    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);

    if (!passwordValid) {
      throw new UnauthorizedException(invalidMessage);
    }

    // Generar JWT access token (1h de expiración)
    const accessToken = this.jwtService.sign(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
      },
      { expiresIn: "1h" },
    );

    // Generar refresh token
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");
    const hashedToken = await bcrypt.hash(rawToken, 10);

    // Almacenar en BD
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: {
        tokenHash,
        token: hashedToken,
        userId: user.id,
        expiresAt,
      },
    });

    // Configurar cookie httpOnly
    const isProduction = process.env["NODE_ENV"] === "production";

    res.cookie("refresh_token", rawToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días en ms
      path: "/",
    });

    return { accessToken };
  }

  // ── Renovación de tokens (refresh) ──────────
  async refresh(
    refreshToken: string | undefined,
    res: Response,
  ): Promise<{ accessToken: string }> {
    if (!refreshToken) {
      throw new UnauthorizedException("Refresh token no proporcionado");
    }

    // SHA-256 del token para búsqueda rápida O(1)
    const tokenHash = crypto
      .createHash("sha256")
      .update(refreshToken)
      .digest("hex");

    // Buscar en BD por tokenHash
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!storedToken) {
      throw new UnauthorizedException("Refresh token inválido");
    }

    // Reuse attack: si el token ya fue revocado, revocar TODOS los tokens del usuario
    if (storedToken.revokedAt) {
      await this.prisma.refreshToken.updateMany({
        where: {
          userId: storedToken.userId,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });

      throw new UnauthorizedException(
        "Reuso detectado: todas las sesiones fueron revocadas",
      );
    }

    // Verificar expiración
    if (storedToken.expiresAt < new Date()) {
      throw new UnauthorizedException("Refresh token expirado");
    }

    // Verificar token con bcrypt
    const tokenValid = await bcrypt.compare(refreshToken, storedToken.token);

    if (!tokenValid) {
      throw new UnauthorizedException("Refresh token inválido");
    }

    // Revocar token actual
    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() },
    });

    // Generar NUEVO par de tokens
    const newAccessToken = this.jwtService.sign(
      {
        sub: storedToken.user.id,
        email: storedToken.user.email,
        role: storedToken.user.role,
      },
      { expiresIn: "1h" },
    );

    // Generar nuevo refresh token
    const newRawToken = crypto.randomBytes(32).toString("hex");
    const newTokenHash = crypto
      .createHash("sha256")
      .update(newRawToken)
      .digest("hex");
    const newHashedToken = await bcrypt.hash(newRawToken, 10);

    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: {
        tokenHash: newTokenHash,
        token: newHashedToken,
        userId: storedToken.user.id,
        expiresAt: newExpiresAt,
      },
    });

    // Configurar nueva cookie
    const isProduction = process.env["NODE_ENV"] === "production";

    res.cookie("refresh_token", newRawToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/",
    });

    return { accessToken: newAccessToken };
  }

  // ── Cierre de sesión ────────────────────────
  async logout(
    refreshToken: string | undefined,
    res: Response,
  ): Promise<void> {
    if (refreshToken) {
      // SHA-256 para búsqueda
      const tokenHash = crypto
        .createHash("sha256")
        .update(refreshToken)
        .digest("hex");

      // Buscar y revocar token
      const storedToken = await this.prisma.refreshToken.findUnique({
        where: { tokenHash },
      });

      if (storedToken) {
        await this.prisma.refreshToken.update({
          where: { id: storedToken.id },
          data: { revokedAt: new Date() },
        });
      }
    }

    // Limpiar cookie siempre
    res.clearCookie("refresh_token", { path: "/" });
  }
}
