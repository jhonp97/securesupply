import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import prettierConfig from "eslint-config-prettier";

// Configuración plana de ESLint 10 para SecureSupply
export default tseslint.config(
  // Configuración base recomendada de ESLint
  eslint.configs.recommended,

  // Configuración recomendada de TypeScript-ESLint
  ...tseslint.configs.recommended,

  // Desactiva reglas que conflicten con Prettier
  prettierConfig,

  // Reglas personalizadas del proyecto
  {
    rules: {
      // Seguridad: prohibir console.log en producción
      "no-console": ["warn", { allow: ["warn", "error"] }],

      // TypeScript
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },

  // Ignorar carpetas de salida
  {
    ignores: ["**/dist/**", "**/.next/**", "**/.turbo/**", "**/node_modules/**", "**/generated/**"],
  },
);
