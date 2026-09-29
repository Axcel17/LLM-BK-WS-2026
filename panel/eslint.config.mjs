import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    // Ignorados por defecto de eslint-config-next.
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",

    // Componentes copiados de la registría de AI Elements y de shadcn/ui.
    // Son código de terceros que vive en el repositorio por el modelo de
    // shadcn —se copia, no se instala—, y aplicarle nuestras reglas produce
    // ruido que tapa los errores propios. Se revisan al actualizarlos, no en
    // cada pasada del linter.
    "src/components/ai-elements/**",
    "src/components/ui/**",
  ]),
]);

export default eslintConfig;
