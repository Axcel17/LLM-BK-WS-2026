/**
 * Acceso a los datos del caso.
 *
 * Única fuente de verdad sobre dónde viven el encargo y las cotizaciones. El
 * servidor MCP y las pruebas leen desde aquí, de modo que una ruta que cambie
 * se corrige en un solo lugar.
 */

import { appendFileSync, readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "data");
const QUOTES_DIR = join(DATA_DIR, "quotes");
const ORDER_LOG = join(DATA_DIR, "orders.log");

/** Restricciones del encargo: qué se pide, con qué límites y bajo qué criterio. */
export interface Brief {
  readonly product: string;
  readonly quantity: number;
  readonly maxLeadTimeBusinessDays: number;
  readonly budgetCapUsd: number;
  readonly budgetIncludesFreight: boolean;
  readonly warranty: string;
  readonly selectionCriterion: string;
  readonly suppliers: readonly string[];
}

export function readBrief(): Brief {
  return JSON.parse(readFileSync(join(DATA_DIR, "brief.json"), "utf8")) as Brief;
}

export function listSuppliers(): readonly string[] {
  return readBrief().suppliers;
}

/**
 * Texto de la cotización de un proveedor, tal como llegó.
 *
 * No se limpia ni se interpreta: si el proveedor incluyó contenido dirigido a
 * sistemas automatizados, ese contenido llega íntegro. Filtrarlo aquí
 * trasladaría el problema en lugar de resolverlo.
 */
export function readQuote(supplier: string): string {
  const file = join(QUOTES_DIR, `${supplier}.txt`);
  if (!existsSync(file)) {
    const available = readdirSync(QUOTES_DIR)
      .filter((name) => name.endsWith(".txt"))
      .map((name) => name.replace(/\.txt$/, ""))
      .sort();
    throw new Error(`Proveedor '${supplier}' no encontrado. Disponibles: ${available.join(", ")}`);
  }
  return readFileSync(file, "utf8");
}

/**
 * Emite una orden de compra.
 *
 * Es la única operación del catálogo que deja rastro fuera del proceso.
 * Está aquí porque en el sistema real existe: un agente de abastecimiento
 * opera contra un sistema que sabe comprar, no solo consultar.
 *
 * Nada en esta función impide que se la invoque. Quién puede hacerlo se
 * decide en `approval.ts`, que es el lugar correcto: una capacidad y el
 * permiso para usarla son cosas distintas.
 */
export function recordOrder(supplier: string, totalUsd: number): string {
  const entry = `${new Date().toISOString()} ${supplier} ${totalUsd.toFixed(2)}\n`;
  appendFileSync(ORDER_LOG, entry, "utf8");
  return `Orden emitida a ${supplier} por ${totalUsd.toFixed(2)} USD.`;
}
