/**
 * El catálogo de proveedores, que es la misma fuente que usan los portales.
 *
 * `data/catalogo.json` es una copia de `catalogo.json` del repositorio de los
 * portales. Dos copias se desfasan, así que `npm run verify-catalog` contrasta
 * esta contra la publicada. Es el mismo trato que `tool-baseline.json` hace con
 * las herramientas MCP: dos sistemas, un contrato, y una comprobación que avisa
 * cuando dejan de coincidir.
 *
 * Copiarla en vez de descargarla es deliberado. Los tramos 1 a 4 corren sin red,
 * y una cotización que dependiera de una descarga dejaría el ejercicio a merced
 * de la conexión de la sala.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { DATA_DIR } from "./paths.js";

export interface Product {
  readonly id: string;
  readonly nombre: string;
  readonly especificacion: string;
  readonly sinonimos: readonly string[];
}

interface Price {
  readonly unitarioUsd?: number;
  readonly conGarantiaExtendidaUsd?: number | null;
  readonly porCajaUsd?: number;
}

export interface Supplier {
  readonly id: string;
  readonly nombre: string;
  readonly razonSocial: string;
  readonly prefijoReferencia: string;
  readonly cotiza: boolean;
  readonly diasEntrega?: number;
  readonly unidadPlazo?: "habiles" | "calendario";
  readonly fleteUsd?: number;
  readonly fleteIncluido?: boolean;
  readonly unidadVenta?: { readonly tipo: string; readonly unidadesPorCaja: number };
  readonly precios: Readonly<Record<string, Price>>;
}

export interface SupplierCatalog {
  readonly version: string;
  readonly productos: readonly Product[];
  readonly proveedores: readonly Supplier[];
  readonly casosDeResolucion: readonly {
    readonly texto: string;
    readonly esperado: string | null;
  }[];
}

let cache: SupplierCatalog | null = null;

export function readSupplierCatalog(): SupplierCatalog {
  if (cache === null) {
    cache = JSON.parse(readFileSync(join(DATA_DIR, "catalogo.json"), "utf8")) as SupplierCatalog;
  }
  return cache;
}

/**
 * Reduce el texto a su contenido para poder compararlo.
 *
 * Es una regla aparte de la de `traceability.ts`, aunque se parezcan: esta está
 * escrita en `catalogo.json` y la implementan dos programas —este y los
 * portales—, así que cambiarla por conveniencia de otra verificación los
 * separaría en silencio. Los catorce casos del propio catálogo son lo que
 * comprueba que sigan de acuerdo.
 */
function normalizeProductText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** El producto del catálogo que pide este texto, o null si no se identifica. */
export function resolveProduct(catalog: SupplierCatalog, text: string): Product | null {
  const asked = normalizeProductText(text);
  if (asked === "") return null;

  let best: Product | null = null;
  let length = 0;

  for (const product of catalog.productos) {
    for (const synonym of [...product.sinonimos, product.nombre]) {
      const needle = normalizeProductText(synonym);
      if (needle !== "" && asked.includes(needle) && needle.length > length) {
        best = product;
        length = needle.length;
      }
    }
  }

  return best;
}

export function supplierByName(catalog: SupplierCatalog, name: string): Supplier | null {
  return catalog.proveedores.find((supplier) => supplier.nombre === name) ?? null;
}

/** Lo que responde un proveedor: cotiza, no lo maneja, o no lo identifica. */
export type SupplierResponse =
  | { readonly kind: "no-quotes"; readonly supplier: Supplier }
  | { readonly kind: "unrecognized"; readonly supplier: Supplier }
  | { readonly kind: "not-carried"; readonly supplier: Supplier; readonly product: Product }
  | {
      readonly kind: "quoted";
      readonly supplier: Supplier;
      readonly product: Product;
      readonly unitUsd: number;
      readonly extendedWarrantyUsd: number | null;
      readonly freightUsd: number;
      readonly lineUsd: number;
      readonly totalUsd: number;
      readonly boxes: number | null;
      readonly perBoxUsd: number | null;
      readonly unitsPerBox: number | null;
    };

export function quoteFor(
  catalog: SupplierCatalog,
  supplier: Supplier,
  text: string,
  quantity: number,
): SupplierResponse {
  if (!supplier.cotiza) return { kind: "no-quotes", supplier };

  const product = resolveProduct(catalog, text);
  if (product === null) return { kind: "unrecognized", supplier };

  const price = supplier.precios[product.id];
  if (price === undefined) return { kind: "not-carried", supplier, product };

  const freightUsd = supplier.fleteUsd ?? 0;

  if (supplier.unidadVenta !== undefined && price.porCajaUsd !== undefined) {
    // No se despachan cajas parciales: pedir 95 unidades se paga como 100.
    const unitsPerBox = supplier.unidadVenta.unidadesPorCaja;
    const boxes = Math.ceil(quantity / unitsPerBox);
    const lineUsd = boxes * price.porCajaUsd;
    return {
      kind: "quoted",
      supplier,
      product,
      unitUsd: price.porCajaUsd / unitsPerBox,
      extendedWarrantyUsd: null,
      freightUsd,
      lineUsd,
      totalUsd: lineUsd + freightUsd,
      boxes,
      perBoxUsd: price.porCajaUsd,
      unitsPerBox,
    };
  }

  const unitUsd = price.unitarioUsd as number;
  const lineUsd = unitUsd * quantity;
  return {
    kind: "quoted",
    supplier,
    product,
    unitUsd,
    extendedWarrantyUsd: price.conGarantiaExtendidaUsd ?? null,
    freightUsd,
    lineUsd,
    totalUsd: lineUsd + freightUsd,
    boxes: null,
    perBoxUsd: null,
    unitsPerBox: null,
  };
}
