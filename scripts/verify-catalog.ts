/**
 * Contrasta el catálogo local contra el que publican los portales.
 *
 * `data/catalogo.json` es una copia de `catalogo.json` del repositorio de los
 * portales, y dos copias se desfasan. Este script las compara: si alguien cambió
 * un precio en un lado y no en el otro, la Parte 1 y la Parte 2 del taller
 * dejaron de describir el mismo mercado, y eso hay que saberlo antes de la sala.
 *
 * Es el mismo trato que `mcp/integrity.ts` hace con las herramientas MCP: dos
 * sistemas, un contrato, y una comprobación que avisa cuando divergen. La
 * diferencia es que aquí el otro sistema está en internet, así que sin red este
 * script no falla: informa que no pudo comprobar.
 *
 *     npm run verify-catalog
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { DATA_DIR } from "../src/domain/catalog.js";
import { resolveProduct, type SupplierCatalog } from "../src/domain/suppliers.js";

const PUBLICADO = "https://axcel17.github.io/proveedores-andes/catalogo.json";

const local = JSON.parse(readFileSync(join(DATA_DIR, "catalogo.json"), "utf8")) as SupplierCatalog;

const problemas: string[] = [];

/**
 * Los casos del propio catálogo, contra esta implementación.
 *
 * La regla de resolución la implementan dos programas. Que el JSON traiga sus
 * propios casos es lo que permite comprobar que no se hayan separado, y esto
 * corre sin red.
 */
for (const caso of local.casosDeResolucion) {
  const obtenido = resolveProduct(local, caso.texto)?.id ?? null;
  if (obtenido !== caso.esperado) {
    problemas.push(
      `Resolución: «${caso.texto}» da ${obtenido ?? "ninguno"} y el catálogo espera ` +
        `${caso.esperado ?? "ninguno"}.`,
    );
  }
}

let remoto: SupplierCatalog | null = null;
try {
  const respuesta = await fetch(PUBLICADO, { cache: "no-store" });
  if (!respuesta.ok) throw new Error(`respondió ${respuesta.status}`);
  remoto = (await respuesta.json()) as SupplierCatalog;
} catch (error) {
  console.log(
    `\nNo se pudo consultar el catálogo publicado: ${(error as Error).message}.\n` +
      "La resolución sí se comprobó. Repita con red antes del evento.\n",
  );
}

if (remoto !== null) {
  /**
   * Se comparan los documentos completos, no solo los precios.
   *
   * La primera versión de esto miraba precios y condiciones, y dejó pasar un
   * campo nuevo que solo existía en una copia. Un contrato se compara entero o
   * no se compara.
   */
  const aplanar = (catalogo: SupplierCatalog): Map<string, string> => {
    const filas = new Map<string, string>();
    for (const producto of catalogo.productos) {
      filas.set(`producto ${producto.id}`, JSON.stringify(producto));
    }
    for (const proveedor of catalogo.proveedores) {
      filas.set(`proveedor ${proveedor.id}`, JSON.stringify(proveedor));
    }
    filas.set("casos de resolución", JSON.stringify(catalogo.casosDeResolucion));
    filas.set("versión", catalogo.version);
    return filas;
  };

  const aqui = aplanar(local);
  const alla = aplanar(remoto);

  for (const [clave, valor] of aqui) {
    const otro = alla.get(clave);
    if (otro === undefined) problemas.push(`Solo aquí: ${clave}.`);
    else if (otro !== valor) problemas.push(`Distinto en ${clave}.`);
  }
  for (const clave of alla.keys()) {
    if (!aqui.has(clave)) problemas.push(`Solo en el publicado: ${clave}.`);
  }
}

if (problemas.length > 0) {
  console.error("\nEl catálogo local y el publicado no coinciden:\n");
  for (const problema of problemas) console.error(`  · ${problema}`);
  console.error(
    "\nSi acaba de cambiar el catálogo de los portales, GitHub Pages tarda unos minutos " +
      "en publicarlo: reintente.\nSi no, copie `catalogo.json` del repositorio de los " +
      "portales a `data/catalogo.json`, o corrija allá lo que corresponda.\n",
  );
  process.exit(1);
}

console.log(
  remoto === null
    ? "Resolución verificada contra los casos del catálogo."
    : `Catálogo verificado: coincide con el publicado (versión ${local.version}).`,
);
