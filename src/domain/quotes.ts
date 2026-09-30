/**
 * Cotizaciones que responden a lo que se pidió.
 *
 * Antes cada proveedor servía un archivo de texto con 40 unidades escritas
 * dentro. Una requisición de 100 monitores recorría toda la cadena —extracción,
 * `BRIEF_JSON`, verificación— y llegaba a un comparativo cuyos totales eran los
 * de otra cantidad: las cuatro verificaciones aritméticas saltaban y no se
 * recomendaba a nadie. La cadena era honesta; la cotización no respondía.
 *
 * Los términos comerciales son los de los portales de la Parte 1, que son la
 * otra mitad del mismo caso: precio unitario, flete y plazo fijos por
 * proveedor, cantidad variable y producto devuelto tal como se pidió. Si un
 * número cambia aquí y no allá, las dos mitades del taller dejan de coincidir.
 *
 * Las plantillas viven en `data/quotes/`, una por proveedor y cada una con su
 * propio formato. Esa diferencia es deliberada: normalizar cinco formatos es lo
 * que ejercita `checkNormalization`.
 */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

/** Cifra con separador de miles y coma decimal, como la escriben los proveedores. */
function money(value: number): string {
  const [whole, cents] = value.toFixed(2).split(".");
  return `${(whole as string).replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${cents}`;
}

/**
 * Términos de cada proveedor, y cómo los escribe.
 *
 * `values` devuelve lo que sustituye a los marcadores de su plantilla. Cada
 * proveedor rellena a su propio ancho porque cada formato es distinto: una
 * tabla alinea columnas y una ficha de dos columnas no.
 */
interface Supplier {
  readonly values: (product: string, quantity: number) => Record<string, string>;
}

/** Fila de tabla: descripción a 45, cantidad a 7, unitario a 11, importe a 12. */
function tableRow(description: string, quantity: number, unitPrice: number): string {
  return (
    description.slice(0, 45).padEnd(45) +
    String(quantity).padStart(7) +
    money(unitPrice).padStart(11) +
    money(unitPrice * quantity).padStart(12)
  );
}

const SUPPLIERS: Record<string, Supplier> = {
  Tecnoimport: {
    values: (product, quantity) => ({
      producto: product,
      linea: tableRow(`${product}, panel IPS 75Hz, HDMI/VGA`, quantity, 168),
      flete: tableRow("Flete y despacho a bodega del cliente", 1, 85),
      unitario: money(168),
      fleteUsd: money(85),
      total: money(168 * quantity + 85),
    }),
  },

  GlobalStock: {
    values: (product, quantity) => ({
      producto: product,
      cantidad: String(quantity),
      unitario: money(149),
      total: money(149 * quantity),
    }),
  },

  MayoristaZeta: {
    values: (product, quantity) => {
      // No se despachan cajas parciales: pedir 95 unidades se paga como 100.
      const boxes = Math.ceil(quantity / 10);
      return {
        producto: product,
        cantidad: String(quantity),
        cajas: String(boxes),
        unidadesFacturadas: String(boxes * 10),
        precioCaja: money(1590),
      };
    },
  },

  "Suministros Delta": {
    values: (product, quantity) => ({
      producto: product,
      linea: tableRow(`${product}, panel IPS 75Hz`, quantity, 164),
      flete: tableRow("Flete y despacho a bodega (no incluido)", 1, 60),
      total: money(164 * quantity + 60),
      unitarioConGarantia: money(179),
    }),
  },

  ImportAndina: {
    values: (product, quantity) => ({
      producto: product,
      cantidad: String(quantity),
    }),
  },
};

/**
 * Texto de la cotización de un proveedor, tal como llegó.
 *
 * No se limpia ni se interpreta: si el proveedor incluyó contenido dirigido a
 * sistemas automatizados, ese contenido llega íntegro. Filtrarlo aquí
 * trasladaría el problema en lugar de resolverlo.
 */
export function renderQuote(
  quotesDir: string,
  supplier: string,
  product: string,
  quantity: number,
): string {
  const terms = SUPPLIERS[supplier];
  const template = join(quotesDir, `${supplier}.txt`);

  if (terms === undefined || !existsSync(template)) {
    const available = readdirSync(quotesDir)
      .filter((name) => name.endsWith(".txt"))
      .map((name) => name.replace(/\.txt$/, ""))
      .sort();
    throw new Error(`Proveedor '${supplier}' no encontrado. Disponibles: ${available.join(", ")}`);
  }

  const values = terms.values(product, quantity);
  return readFileSync(template, "utf8").replace(/\{\{(\w+)\}\}/g, (_, name: string) => {
    const value = values[name];
    if (value === undefined) {
      throw new Error(`La plantilla de '${supplier}' usa {{${name}}}, que no se calcula.`);
    }
    return value;
  });
}
