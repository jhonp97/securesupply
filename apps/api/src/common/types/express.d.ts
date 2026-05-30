// ─────────────────────────────────────────────
// Declaración de tipos extendidos para Express
// Agrega la propiedad `user` al Request de Express
// (seteada por AuthGuard tras verificar JWT)
// ─────────────────────────────────────────────

import "express";

/** Payload del JWT decodificado por AuthGuard */
interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

declare global {
  namespace Express {
    interface Request {
      /** Usuario autenticado (seteado por AuthGuard) */
      user: JwtPayload;
      /** Body crudo para verificación HMAC de webhooks */
      rawBody?: Buffer;
    }
  }
}
