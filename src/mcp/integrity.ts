/**
 * Integridad del catálogo de herramientas.
 *
 * El agente consume un servidor MCP que no controla. La descripción de una
 * herramienta es lo único que el modelo lee para decidir si la usa y con qué
 * argumentos, de modo que **un cambio en esa descripción cambia el
 * comportamiento del agente sin que este proyecto se entere**.
 *
 * Ese es el vector del envenenamiento de herramienta: no hace falta tocar el
 * código del agente, basta con editar el texto que el servidor declara.
 *
 * Aquí se fija una huella de las herramientas y se compara contra la de la
 * corrida anterior. Un cambio no detiene la ejecución, porque puede ser
 * legítimo —el proveedor publicó una versión nueva—, pero deja de pasar
 * inadvertido.
 */

import { detectToolDrift, fingerprintTools, type ToolSet } from "ai";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { DATA_DIR } from "../domain/catalog.js";

const BASELINE_FILE = join(DATA_DIR, "tool-baseline.json");

/** Resultado de comparar el catálogo actual contra la huella registrada. */
export interface DriftReport {
  /** False en la primera corrida: no hay contra qué comparar todavía. */
  readonly hasBaseline: boolean;
  readonly added: readonly string[];
  readonly removed: readonly string[];
  /** Herramientas cuya definición cambió conservando el nombre. Las que importan. */
  readonly changed: readonly string[];
}

function readBaseline(): Record<string, string> | undefined {
  if (!existsSync(BASELINE_FILE)) return undefined;
  return JSON.parse(readFileSync(BASELINE_FILE, "utf8")) as Record<string, string>;
}

/** Registra el catálogo actual como la referencia válida. */
export async function writeBaseline(tools: ToolSet): Promise<void> {
  const fingerprints = await fingerprintTools(tools);
  writeFileSync(BASELINE_FILE, `${JSON.stringify(fingerprints, null, 2)}\n`, "utf8");
}

/** Compara el catálogo recibido contra la huella registrada. */
export async function checkToolIntegrity(tools: ToolSet): Promise<DriftReport> {
  const baseline = readBaseline();
  if (!baseline) return { hasBaseline: false, added: [], removed: [], changed: [] };

  const current = await fingerprintTools(tools);
  return { hasBaseline: true, ...detectToolDrift(current, baseline) };
}

/** True si el catálogo difiere de la referencia en algo. */
export function hasDrift(report: DriftReport): boolean {
  return report.added.length + report.removed.length + report.changed.length > 0;
}
