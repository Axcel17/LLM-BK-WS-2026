/**
 * Contrato de datos de la salida del agente.
 *
 * Declara la forma exacta que debe tener un comparativo para considerarse
 * válido. Una salida que no lo cumple se rechaza antes de llegar a las
 * verificaciones, y el arnés la devuelve al modelo con el error para que la
 * corrija.
 *
 * Los esquemas de Zod cumplen dos funciones a la vez: validan en ejecución y
 * derivan los tipos de TypeScript, de modo que un contrato mal usado falla al
 * compilar y no solo al correr.
 */

import { z } from "zod";

/**
 * Las restricciones contra las que se verifica un comparativo.
 *
 * No son constantes del código: salen de la requisición. Tenerlas fijas aquí
 * significaba que una requisición con otro tope se verificaba igual contra
 * 7.000 —y sin fallar—, de modo que la capa que existe para detectar errores
 * validaba un encargo que ya no existía.
 */
export type Constraints = {
  readonly quantity: number;
  readonly maxLeadTimeBusinessDays: number;
  readonly budgetCapUsd: number;
};

/**
 * Cotas absolutas de plausibilidad, independientes de la requisición.
 *
 * No son restricciones de negocio: son el piso y el techo de lo que puede ser
 * un importe real. Un esquema estricto obliga al modelo a poner algo en un
 * campo obligatorio, y sin estas cotas rellena con valores inventados que
 * parecen válidos.
 */
const TOTAL_MINIMO_PLAUSIBLE = 1;
const TOTAL_MAXIMO_PLAUSIBLE = 10_000_000;

/** Contenido externo que intentó dar instrucciones al sistema. */
export const anomalySchema = z.object({
  supplier: z.string(),
  detectedText: z
    .string()
    .min(1)
    .describe("Cita textual del contenido que intentó dar instrucciones"),
  whatItAskedFor: z.string(),
  actionTaken: z.string(),
});

/** Una cotización, ya normalizada a base comparable. */
const quoteSchemaDe = (c: Constraints) =>
  z.object({
    supplier: z.string(),

    // Positivo obligatorio: un precio de cero o negativo no es una cotización.
    unitPriceUsd: z
      .number()
      .positive()
      .describe("Precio por unidad, normalizado desde la forma en que cotizó el proveedor"),

    freightUsd: z.number().min(0).describe("0 si el proveedor lo incluye en el precio"),

    totalDeliveredUsd: z
      .number()
      .positive()
      // Piso y techo de plausibilidad. Un esquema estricto obliga al modelo a
      // poner algo en un campo obligatorio; sin estos límites rellena con valores
      // inventados y el resultado parece válido. Son cotas absolutas y no
      // restricciones de negocio: el tope del encargo lo comprueba
      // `checkHardLimits`, que lo recibe de la requisición.
      // Piso y techo derivados de la requisición. Un esquema estricto obliga al
      // modelo a poner algo en un campo obligatorio; sin estas cotas rellena con
      // un valor inventado que parece válido. Y a diferencia de una
      // verificación, esto **impide** la salida en lugar de reportarla: el arnés
      // devuelve el error y el modelo corrige.
      .min(c.quantity, `Un total menor que ${c.quantity} implica menos de un dólar por unidad`)
      .max(c.budgetCapUsd * 3, "Total implausible: revise si el precio venía por lote"),

    // Anulable porque un proveedor puede no declarar plazo, y obligatorio para
    // que el modelo no pueda omitirlo: sin este dato la verificación de plazo no
    // tiene nada que comprobar.
    leadTimeBusinessDays: z
      .number()
      .int()
      .min(0)
      .nullable()
      .describe("Plazo convertido a días hábiles. null si el proveedor no lo declara"),

    meetsLeadTime: z.boolean(),
    meetsBudget: z.boolean(),

    evidence: z
      .string()
      .min(10)
      .describe("Cita textual de la cotización que sustenta los números anteriores"),
  });

/**
 * Un proveedor consultado que no entregó cotización.
 *
 * Cinco motivos, y ninguno es un error. Que un proveedor no maneje el producto
 * —o no lo identifique— es información sobre el mercado, igual que un plazo
 * imposible: registrarlo como cotización con un cero lo convertiría en una
 * oferta barata, y el comparativo recomendaría a quien no puede vender.
 */
export const noResponseSchema = z.object({
  supplier: z.string(),
  status: z.enum([
    "in_progress",
    "awaiting_clarification",
    "no_contact",
    "product_not_carried",
    "product_not_identified",
  ]),
  detail: z.string(),
});

/** La salida completa del agente. */
const comparisonSchemaDe = (c: Constraints) =>
  z.object({
    quotes: z.array(quoteSchemaDe(c)),

    // Sin valor por defecto: declararla es obligatorio, de modo que una lista
    // vacía sea una afirmación explícita y no el resultado de no haber mirado.
    noResponse: z.array(noResponseSchema),

    // Sin valor por defecto, por la misma razón que `noResponse`: un campo
    // opcional es un campo que el modelo omite, y la salida estructurada
    // estricta de algunos proveedores rechaza el esquema si no es obligatorio.
    // Una lista vacía tiene que ser una afirmación explícita.
    anomalies: z.array(anomalySchema),
    recommendedSupplier: z.string().nullable(),
    rationale: z.string().min(20),
  });

/**
 * El contrato de salida, construido con las restricciones de la requisición.
 *
 * Es una fábrica y no una constante porque las cotas de plausibilidad dependen
 * de lo que se pidió. Y siguen en el esquema, no en una verificación, por una
 * diferencia que importa: un esquema **impide** la salida —el arnés devuelve el
 * error y el modelo corrige— mientras que una verificación solo la reporta.
 */
export function makeComparisonSchema(c: Constraints) {
  return comparisonSchemaDe(c);
}

/**
 * Campos de la requisición que el agente puede declarar faltantes.
 *
 * Es un enumerado y no texto libre a propósito. Con texto libre, «falta el
 * presupuesto» y «no sé cuánto puedo gastar» son cadenas distintas que ninguna
 * verificación puede contrastar contra la requisición. Con un enumerado, la
 * comprobación es exacta: o el dato estaba, o no estaba.
 */
export const requisitionFieldSchema = z.enum([
  "product",
  "quantity",
  "maxLeadTimeBusinessDays",
  "budgetCapUsd",
  "warranty",
  "suppliers",
]);

export type RequisitionField = z.infer<typeof requisitionFieldSchema>;

/** Un dato que falta para poder proceder, con el motivo. */
export const missingFieldSchema = z.object({
  field: requisitionFieldSchema,
  why: z.string().min(15).describe("Por qué sin ese dato no se puede continuar"),
});

/**
 * Lo que el agente entrega, que no siempre es un comparativo.
 *
 * El contrato anterior obligaba a producir uno siempre, así que ante una
 * requisición incompleta la única salida disponible era inventar.
 *
 * La forma es discriminante más ramas anulables, y no una unión discriminada,
 * porque la salida estructurada estricta de OpenAI rechaza `oneOf` en la raíz.
 */
const outcomeSchemaDe = (c: Constraints) =>
  z
    .object({
      status: z.enum(["resolved", "missing_information", "out_of_scope"]),

      /** El comparativo, o null si no se pudo construir. */
      comparison: comparisonSchemaDe(c).nullable(),

      /** Qué falta para poder proceder. Vacío cuando se resolvió. */
      missing: z.array(missingFieldSchema),

      /** Una pregunta concreta para quien pidió el trabajo, o null. */
      question: z.string().min(15).nullable(),

      /** Por qué queda fuera de alcance, o null. */
      outOfScopeReason: z.string().min(15).nullable(),
    })
    .refine(
      (outcome) =>
        outcome.status !== "resolved" ||
        (outcome.comparison !== null && outcome.missing.length === 0),
      {
        message: "Un resultado resuelto exige comparativo y ninguna carencia",
        path: ["comparison"],
      },
    )
    .refine(
      (outcome) =>
        outcome.status !== "missing_information" ||
        (outcome.missing.length > 0 && outcome.question !== null),
      {
        message: "Declarar que falta información exige enumerar qué falta y preguntarlo",
        path: ["missing"],
      },
    )
    .refine((outcome) => outcome.status !== "out_of_scope" || outcome.outOfScopeReason !== null, {
      message: "Declarar algo fuera de alcance exige decir por qué",
      path: ["outOfScopeReason"],
    });

/**
 * Lo que el agente entrega, construido con las restricciones de la requisición.
 *
 * Es lo que recibe `Output.object`: el contrato completo, con la rama de
 * comparativo y la de «no puedo proceder».
 */
export function makeOutcomeSchema(c: Constraints) {
  return outcomeSchemaDe(c);
}

export type MissingField = z.infer<typeof missingFieldSchema>;
export type Outcome = z.infer<ReturnType<typeof outcomeSchemaDe>>;

export type Anomaly = z.infer<typeof anomalySchema>;
export type Quote = z.infer<ReturnType<typeof quoteSchemaDe>>;
export type NoResponse = z.infer<typeof noResponseSchema>;
export type Comparison = z.infer<ReturnType<typeof comparisonSchemaDe>>;
