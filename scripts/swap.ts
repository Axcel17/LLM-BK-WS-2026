/**
 * Intercambia los archivos con `TODO` por sus soluciones, y viceversa.
 *
 * `scripts/solutions/` tiene las versiones completas y `scripts/gaps/` las que
 * llevan los `TODO`. `src/` contiene la que está activa.
 *
 * Ejecutar el agente no altera `src/`, pero resolver los `TODO` durante un
 * ensayo sí. Restaurar antes de distribuir el material.
 *
 * **Antes de sobrescribir, guarda lo que hubiera escrito quien lo ejecuta.** Un
 * asistente atascado en un `TODO` mira la solución y pierde media hora de
 * trabajo: el comando existe para ayudar, no para castigar la curiosidad.
 *
 *     npx tsx scripts/swap.ts gaps        lo que recibe el asistente
 *     npx tsx scripts/swap.ts solutions   el proyecto completo
 */

import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
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

const source = join(ROOT, "scripts", mode === "gaps" ? "gaps" : "solutions");
const BACKUP = join(ROOT, "scripts", ".tuyo");

/** Lo que está en `src/` no viene de este repositorio: lo escribió alguien. */
function esTrabajoPropio(actual: string, file: string): boolean {
  const gaps = readFileSync(join(ROOT, "scripts", "gaps", file), "utf8");
  const solutions = readFileSync(join(ROOT, "scripts", "solutions", file), "utf8");
  return actual !== gaps && actual !== solutions;
}

const guardados: string[] = [];
let markers = 0;

for (const { file, target } of SWAPPABLE) {
  const destino = join(ROOT, "src", target);

  if (esTrabajoPropio(readFileSync(destino, "utf8"), file)) {
    mkdirSync(BACKUP, { recursive: true });
    copyFileSync(destino, join(BACKUP, file));
    guardados.push(`${file} → src/${target}`);
  }

  const from = join(source, file);
  copyFileSync(from, destino);
  markers += (readFileSync(from, "utf8").match(/TODO\(/g) ?? []).length;
}

console.log(`  src/ ahora tiene las versiones con ${mode === "gaps" ? "TODO" : "soluciones"}.`);
console.log(`  Marcas TODO: ${markers}`);

if (guardados.length > 0) {
  console.log(`\n  Lo que llevaba escrito quedó en scripts/.tuyo/ :`);
  for (const g of guardados) console.log(`    ${g}`);
  console.log(`  Para recuperarlo:  cp scripts/.tuyo/<archivo> src/<ruta>`);
}

console.log(`\n  Verifique con: npm test`);
