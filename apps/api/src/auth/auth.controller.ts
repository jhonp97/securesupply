// ─────────────────────────────────────────────
// AuthController — Endpoints de autenticación
// POST /auth/register, POST /auth/login,
// POST /auth/refresh, DELETE /auth/logout
// ─────────────────────────────────────────────

import {
  Controller,
  Post,
  Delete,
  Body,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  Inject,
  UsePipes,
} from "@nestjs/common";
import { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { RegisterSchema, RegisterDto } from "./dto/register.dto";
import { LoginSchema, LoginDto } from "./dto/login.dto";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";

@Controller("auth")
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
  ) {}

  @Post("register")
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ZodValidationPipe(RegisterSchema))
  async register(@Body() dto: RegisterDto) {
    await this.authService.register(dto);
    return { message: "Usuario registrado exitosamente" };
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(LoginSchema))
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    return this.authService.login(dto, res);
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.["refresh_token"];
    return this.authService.refresh(refreshToken, res);
  }

  @Delete("logout")
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.["refresh_token"];
    await this.authService.logout(refreshToken, res);
    return { message: "Sesión cerrada exitosamente" };
  }
}
