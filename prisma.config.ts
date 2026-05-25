// ─────────────────────────────────────────────
// Configuración de Prisma 7
// Se ejecuta en Node directamente (NO via bundler)
// ─────────────────────────────────────────────
// La URL de la base de datos se obtiene de DATABASE_URL
// vía env() — NO hay URL hardcodeada aquí ni en schema.prisma
// ─────────────────────────────────────────────

import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  // Ruta al archivo de schema (relativa a la raíz del proyecto)
  schema: 'apps/api/prisma/schema.prisma',

  // Directorio de migraciones
  migrations: {
    path: 'apps/api/prisma/migrations',
  },

  // Datasource: la URL se obtiene exclusivamente de DATABASE_URL
  datasource: {
    url: env('DATABASE_URL'),
  },
});
