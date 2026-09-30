/**
 * Acceso a los datos del caso.
 *
 * Única fuente de verdad sobre dónde viven el encargo y las cotizaciones. El
 * servidor MCP y las pruebas leen desde aquí, de modo que una ruta que cambie
 * se corrige en un solo lugar.
 */

import { appendFileSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { DATA_DIR } from "./paths.js";
import { renderQuote } from "./quotes.js";
import type { Constraints } from "./schemas.js";

export { DATA_DIR } from "./paths.js";

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

/**
 * La requisición del caso, o la que traiga el entorno.
 *
 * `BRIEF_JSON` permite correr contra una requisición distinta sin tocar el
 * archivo. El servidor MCP corre en otro proceso, así que es la forma de que
 * `get_brief` sirva lo mismo que verifican las comprobaciones.
 */
export function readBrief(): Brief {
  const fromEnv = process.env["BRIEF_JSON"];
  if (fromEnv !== undefined && fromEnv.trim() !== "") return JSON.parse(fromEnv) as Brief;
  return JSON.parse(readFileSync(join(DATA_DIR, "brief.json"), "utf8")) as Brief;
}

/**
 * Las restricciones contra las que se verifica, derivadas de la requisición.
 *
 * Es el único lugar donde se traduce la requisición a lo que las verificaciones
 * comprueban. Con las cifras repetidas en el código, cambiar la requisición
 * dejaba a las verificaciones validando un encargo que ya no existía.
 */
export function constraintsOf(brief: Brief): Constraints {
  return {
    quantity: brief.quantity,
    maxLeadTimeBusinessDays: brief.maxLeadTimeBusinessDays,
    budgetCapUsd: brief.budgetCapUsd,
  };
}

export function listSuppliers(): readonly string[] {
  return readBrief().suppliers;
}

/**
 * Texto de la cotización de un proveedor, para lo que pide la requisición.
 *
 * El producto y la cantidad salen de la requisición, no de quien llama. Si el
 * agente pudiera elegir qué cantidad cotizar, pediría 40 donde la requisición
 * dice 100 y la verificación aritmética daría por bueno el resultado: sería
 * calificar su propio examen, que es justo lo que la admisión separada evita.
 *
 * No se limpia ni se interpreta: si el proveedor incluyó contenido dirigido a
 * sistemas automatizados, ese contenido llega íntegro. Filtrarlo aquí
 * trasladaría el problema en lugar de resolverlo.
 */
export function readQuote(supplier: string): string {
  const brief = readBrief();
  return renderQuote(supplier, brief.product, brief.quantity);
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
