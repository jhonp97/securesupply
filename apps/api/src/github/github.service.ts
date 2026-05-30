// ─────────────────────────────────────────────
// GitHubService — Cliente de GitHub App
// Gestiona autenticación JWT como App,
// generación de tokens de instalación
// y obtención de metadata de repositorios.
// NUNCA almacena tokens de instalación en BD.
// ─────────────────────────────────────────────

import { Injectable, Logger } from "@nestjs/common";
import { App } from "octokit";
import { createAppAuth } from "@octokit/auth-app";

/** Metadata de repositorio retornada por la API de GitHub */
export interface RepoInfo {
  id: number;
  full_name: string;
  default_branch: string;
  private: boolean;
  html_url: string;
}

@Injectable()
export class GitHubService {
  private readonly logger = new Logger(GitHubService.name);

  /** Instancia única de App (autenticación como GitHub App) */
  private app: App | null = null;

  /**
   * Crea (o reutiliza) un cliente autenticado como GitHub App.
   * Usa JWT firmado con la clave privada de la App.
   */
  createAppClient(): App {
    if (!this.app) {
      const appId = process.env["GITHUB_APP_ID"];
      const privateKey = process.env["GITHUB_APP_PRIVATE_KEY"];

      if (!appId || !privateKey) {
        throw new Error(
          "GITHUB_APP_ID y GITHUB_APP_PRIVATE_KEY son obligatorios",
        );
      }

      this.app = new App({
        appId,
        privateKey,
      });

      this.logger.debug("Cliente de GitHub App inicializado");
    }

    return this.app;
  }

  /**
   * Genera un token de instalación de corta duración (1 hora).
   * El token NUNCA se almacena en BD — se usa en memoria y se descarta.
   *
   * @param installationId - ID de la instalación de GitHub App
   * @returns Token de acceso de la instalación (string)
   */
  async getInstallationToken(installationId: number): Promise<string> {
    const appId = process.env["GITHUB_APP_ID"];
    const privateKey = process.env["GITHUB_APP_PRIVATE_KEY"];

    if (!appId || !privateKey) {
      throw new Error(
        "GITHUB_APP_ID y GITHUB_APP_PRIVATE_KEY son obligatorios",
      );
    }

    try {
      // Usar createAppAuth directamente para obtener el token crudo
      const auth = createAppAuth({
        appId,
        privateKey,
        installationId,
      });

      const { token } = await auth({ type: "installation" });

      this.logger.debug(
        `Token de instalación generado para instalación ${installationId}`,
      );

      return token;
    } catch (error) {
      this.logger.error(
        `Error al generar token para instalación ${installationId}: ${error instanceof Error ? error.message : "error desconocido"}`,
      );
      throw error;
    }
  }

  /**
   * Obtiene metadata de un repositorio usando un token de instalación.
   *
   * @param owner - Propietario del repositorio (usuario u organización)
   * @param repo - Nombre del repositorio
   * @param installationId - ID de la instalación para autenticación
   * @returns Metadata del repositorio (id, full_name, default_branch, private)
   */
  async getRepoInfo(
    owner: string,
    repo: string,
    installationId: number,
  ): Promise<RepoInfo> {
    const app = this.createAppClient();

    try {
      const installationOctokit =
        await app.getInstallationOctokit(installationId);

      const { data } = await installationOctokit.rest.repos.get({
        owner,
        repo,
      });

      this.logger.debug(`Info de repo obtenida: ${data.full_name}`);

      return {
        id: data.id,
        full_name: data.full_name,
        default_branch: data.default_branch,
        private: data.private,
        html_url: data.html_url,
      };
    } catch (error) {
      this.logger.error(
        `Error al obtener info de ${owner}/${repo}: ${error instanceof Error ? error.message : "error desconocido"}`,
      );
      throw error;
    }
  }
}
