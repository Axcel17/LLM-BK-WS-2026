/**
 * Dónde viven los datos del caso.
 *
 * Vive aparte porque lo necesitan tres módulos que se importan entre sí:
 * `catalog.ts` lee el encargo, `quotes.ts` las plantillas y `suppliers.ts` el
 * catálogo. Con la constante en cualquiera de ellos, el ciclo hacía que uno se
 * evaluara antes de que el otro la hubiera inicializado.
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "data");
export const QUOTES_DIR = join(DATA_DIR, "quotes");
