import { describe, it, expect } from "vitest";
import { validateGitHubUrl } from "./url-validator.js";

// ─────────────────────────────────────────────
// Tests para validateGitHubUrl — Anti-SSRF
// ─────────────────────────────────────────────

describe("validateGitHubUrl", () => {
  // ── Happy path ──

  it("acepta una repositorio válido de GitHub con HTTPS", () => {
    expect(validateGitHubUrl("https://github.com/owner/repo")).toBe(true);
  });

  it("acepta URLs con path profundo (sub-rutas válidas)", () => {
    expect(validateGitHubUrl("https://github.com/owner/repo/tree/main/src")).toBe(true);
  });

  // ── Protocolo inválido ──

  it("rechaza protocolo HTTP (solo HTTPS permitido)", () => {
    expect(validateGitHubUrl("http://github.com/owner/repo")).toBe(false);
  });

  it("rechaza esquema file:// (prevención de acceso a archivos locales)", () => {
    expect(validateGitHubUrl("file:///etc/passwd")).toBe(false);
  });

  it("rechaza esquema ssh:// (prevención de acceso remoto)", () => {
    expect(validateGitHubUrl("ssh://github.com/owner/repo")).toBe(false);
  });

  // ── IPs privadas y localhost (anti-SSRF) ──

  it("rechaza IP privada 192.168.x.x", () => {
    expect(validateGitHubUrl("https://192.168.1.1/owner/repo")).toBe(false);
  });

  it("rechaza IP privada 10.x.x.x", () => {
    expect(validateGitHubUrl("https://10.0.0.1/owner/repo")).toBe(false);
  });

  it("rechaza IP privada 172.16-31.x.x", () => {
    expect(validateGitHubUrl("https://172.16.0.1/owner/repo")).toBe(false);
    expect(validateGitHubUrl("https://172.31.255.255/owner/repo")).toBe(false);
  });

  it("rechaza localhost", () => {
    expect(validateGitHubUrl("https://localhost/owner/repo")).toBe(false);
  });

  it("rechaza loopback 127.0.0.1", () => {
    expect(validateGitHubUrl("https://127.0.0.1/owner/repo")).toBe(false);
  });

  // ── Hostname inválido ──

  it("rechaza dominios que no son github.com", () => {
    expect(validateGitHubUrl("https://evil.com/owner/repo")).toBe(false);
  });

  it("rechaza subdominios sospechosos de github.com", () => {
    expect(validateGitHubUrl("https://evil.github.com/owner/repo")).toBe(false);
  });

  // ── Path traversal ──

  it("rechaza intentos de path traversal (normalizado por URL)", () => {
    // URL constructor normaliza "/../" — verificamos que no pase el filtro
    expect(validateGitHubUrl("https://github.com/../etc")).toBe(false);
  });

  // ── Casos borde ──

  it("rechaza string vacío", () => {
    expect(validateGitHubUrl("")).toBe(false);
  });

  it("rechaza string que no es URL válida", () => {
    expect(validateGitHubUrl("not-a-url")).toBe(false);
  });
});
