/**
 * Intercambia los archivos con huecos por sus soluciones, y viceversa.
 *
 * `solutions/` tiene las versiones completas; `scripts/gaps/` las versiones con
 * huecos. `src/` contiene la que está activa.
 *
 * Ejecutar el agente no altera `src/`, pero resolver los huecos durante un
 * ensayo sí. Restaurar antes de distribuir el material.
 *
 *     npx tsx scripts/swap.ts gaps        lo que recibe el asistente
 *     npx tsx scripts/swap.ts solutions   el proyecto completo
 */

import { copyFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Cada archivo intercambiable y su destino dentro de `src/`. */
const SWAPPABLE = [
  { file: "schemas.ts", target: join("domain", "schemas.ts") },
  { file: "client.ts", target: join("mcp", "client.ts") },
  { file: "checks.ts", target: join("guardrails", "checks.ts") },
] as const;

const mode = process.argv[2];

if (mode !== "gaps" && mode !== "solutions") {
  console.error("  Uso: npx tsx scripts/swap.ts gaps|solutions");
  process.exit(1);
}

const source = mode === "gaps" ? join(ROOT, "scripts", "gaps") : join(ROOT, "solutions");

let markers = 0;
for (const { file, target } of SWAPPABLE) {
  const from = join(source, file);
  copyFileSync(from, join(ROOT, "src", target));
  markers += (readFileSync(from, "utf8").match(/TODO\(/g) ?? []).length;
}

console.log(`  src/ ahora tiene las versiones con ${mode === "gaps" ? "huecos" : "soluciones"}.`);
console.log(`  Marcas TODO: ${markers}`);
console.log(`  Verifique con: npm test`);
