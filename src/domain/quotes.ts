/**
 * Cotizaciones que responden a lo que se pidió.
 *
 * Antes cada proveedor servía un archivo de texto con 40 unidades de monitor
 * escritas dentro. Una requisición de 100 recorría toda la cadena —extracción,
 * `BRIEF_JSON`, verificación— y llegaba a un comparativo cuyos totales eran los
 * de otra cantidad; y pedir cualquier otro producto devolvía un precio de
 * monitor con la descripción del monitor. La cadena era honesta; la cotización
 * no respondía.
 *
 * Los términos comerciales salen de `data/catalogo.json`, que es una copia de la
 * fuente que usan los portales de la Parte 1. Si un precio cambia en un lado y
 * no en el otro, `npm run verify-catalog` lo dice.
 *
 * Tres respuestas posibles, y las tres son resultados: cotiza, no maneja el
 * producto, o no lo identifica. Una ausencia no es un cero.
 *
 * Las plantillas viven en `data/quotes/`, una por proveedor y cada una con su
 * propio formato. Esa diferencia es deliberada: normalizar cinco formatos es lo
 * que ejercita `checkNormalization`.
 */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { DATA_DIR, QUOTES_DIR } from "./paths.js";
import {
  quoteFor,
  readSupplierCatalog,
  supplierByName,
  type Supplier,
  type SupplierResponse,
} from "./suppliers.js";

/** Cifra con separador de miles y coma decimal, como la escriben los proveedores. */
function money(value: number): string {
  const [whole, cents] = value.toFixed(2).split(".");
  return `${(whole as string).replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${cents}`;
}

/**
 * Sin tildes, que es como escriben estos sistemas.
 *
 * El catálogo guarda «Estación de acople USB-C» porque es texto que se muestra, y
 * los portales lo imprimen así. Estas plantillas simulan la salida de un sistema
 * antiguo en texto plano, y por eso lo transcriben sin acentos. Es una decisión de
 * presentación, no un dato distinto.
 */
function plain(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Fila de tabla: descripción a 45, cantidad a 7, unitario a 11, importe a 12. */
function tableRow(description: string, quantity: number, unitPrice: number): string {
  return (
    plain(description).slice(0, 45).padEnd(45) +
    String(quantity).padStart(7) +
    money(unitPrice).padStart(11) +
    money(unitPrice * quantity).padStart(12)
  );
}

/** Lo que sustituye a los marcadores de la plantilla de cada proveedor. */
type Values = Record<string, string>;

const QUOTED: Record<
  string,
  (r: Extract<SupplierResponse, { kind: "quoted" }>, q: number) => Values
> = {
  Tecnoimport: (r, quantity) => ({
    producto: plain(r.product.nombre),
    linea: tableRow(r.product.nombre, quantity, r.unitUsd),
    flete: tableRow("Flete y despacho a bodega del cliente", 1, r.freightUsd),
    unitario: money(r.unitUsd),
    fleteUsd: money(r.freightUsd),
    total: money(r.totalUsd),
  }),

  GlobalStock: (r, quantity) => ({
    producto: plain(r.product.nombre),
    cantidad: String(quantity),
    unitario: money(r.unitUsd),
    total: money(r.totalUsd),
  }),

  MayoristaZeta: (r, quantity) => ({
    producto: plain(r.product.nombre),
    cantidad: String(quantity),
    cajas: String(r.boxes),
    unidadesFacturadas: String((r.boxes as number) * (r.unitsPerBox as number)),
    precioCaja: money(r.perBoxUsd as number),
  }),

  "Suministros Delta": (r, quantity) => ({
    producto: plain(r.product.nombre),
    linea: tableRow(r.product.nombre, quantity, r.unitUsd),
    flete: tableRow("Flete y despacho a bodega (no incluido)", 1, r.freightUsd),
    total: money(r.totalUsd),
    unitarioConGarantia: money(r.extendedWarrantyUsd ?? r.unitUsd),
  }),

  ImportAndina: (r, quantity) => ({
    producto: plain(r.product.nombre),
    cantidad: String(quantity),
  }),
};

function fill(template: string, values: Values, supplier: string): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, name: string) => {
    const value = values[name];
    if (value === undefined) {
      throw new Error(`La plantilla de '${supplier}' usa {{${name}}}, que no se calcula.`);
    }
    return value;
  });
}

function reference(supplier: Supplier): string {
  return `${supplier.prefijoReferencia}-20260916-0000`;
}

/**
 * Texto de la cotización de un proveedor, tal como llegó.
 *
 * No se limpia ni se interpreta: si el proveedor incluyó contenido dirigido a
 * sistemas automatizados, ese contenido llega íntegro. Filtrarlo aquí
 * trasladaría el problema en lugar de resolverlo.
 */
export function renderQuote(supplierName: string, product: string, quantity: number): string {
  const catalog = readSupplierCatalog();
  const supplier = supplierByName(catalog, supplierName);
  const template = join(QUOTES_DIR, `${supplierName}.txt`);

  if (supplier === null || !existsSync(template)) {
    const available = readdirSync(QUOTES_DIR)
      .filter((name) => name.endsWith(".txt"))
      .map((name) => name.replace(/\.txt$/, ""))
      .sort();
    throw new Error(
      `Proveedor '${supplierName}' no encontrado. Disponibles: ${available.join(", ")}`,
    );
  }

  const response = quoteFor(catalog, supplier, product, quantity);

  if (response.kind === "unrecognized") {
    return fill(
      readFileSync(join(DATA_DIR, "producto-no-identificado.txt"), "utf8"),
      {
        razonSocial: supplier.razonSocial,
        referencia: reference(supplier),
        pedido: plain(product),
        cantidad: String(quantity),
      },
      supplierName,
    );
  }

  if (response.kind === "not-carried") {
    return fill(
      readFileSync(join(DATA_DIR, "sin-cotizacion.txt"), "utf8"),
      {
        razonSocial: supplier.razonSocial,
        referencia: reference(supplier),
        producto: plain(response.product.nombre),
        cantidad: String(quantity),
      },
      supplierName,
    );
  }

  // `no-quotes` cae en la plantilla del proveedor, que es la que describe su
  // solicitud en trámite: ImportAndina recibe y no emite, y eso es su formato.
  const values =
    response.kind === "no-quotes"
      ? { producto: plain(product), cantidad: String(quantity) }
      : (QUOTED[supplierName] as (r: typeof response, q: number) => Values)(response, quantity);

  return fill(readFileSync(template, "utf8"), values, supplierName);
}
