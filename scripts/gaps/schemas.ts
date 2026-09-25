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
 *
 * Dos `TODO` marcados. El editor los lista en su panel de tareas pendientes.
 * `npm test -- schemas` es la condición de parada.
 */

import { z } from "zod";

/** Constantes del encargo. Se usan en validaciones y verificaciones. */
export const QUANTITY = 40;
export const MAX_LEAD_TIME_BUSINESS_DAYS = 10;
export const BUDGET_CAP_USD = 7_000;

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
export const quoteSchema = z.object({
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
    // poner algo en un campo obligatorio; sin estos límites rellena con
    // valores inventados y el resultado parece válido.
    .min(QUANTITY, `Un total menor que ${QUANTITY} implica menos de un dólar por unidad`)
    .max(BUDGET_CAP_USD * 3, "Total implausible: revise si el precio venía por lote"),

  // TODO(1a): el plazo
  // Tal como está, el modelo puede omitir el campo y el esquema lo acepta.
  // Sin este dato, la verificación de plazo del tramo 4 no tiene nada que
  // comprobar y pasa en verde sobre una salida incompleta.
  //
  // Un proveedor puede no declarar plazo, así que hay que poder representarlo.
  // Pero omitir un campo no es lo mismo que declararlo desconocido.
  leadTimeBusinessDays: z
    .number()
    .int()
    .min(0)
    .nullable()
    .default(null)
    .describe("Plazo convertido a días hábiles. null si el proveedor no lo declara"),

  meetsLeadTime: z.boolean(),
  meetsBudget: z.boolean(),

  evidence: z
    .string()
    .min(10)
    .describe("Cita textual de la cotización que sustenta los números anteriores"),
});

/** Un proveedor consultado que no entregó cotización. */
export const noResponseSchema = z.object({
  supplier: z.string(),
  status: z.enum(["in_progress", "awaiting_clarification", "no_contact"]),
  detail: z.string(),
});

/** La salida completa del agente. */
export const comparisonSchema = z
  .object({
    quotes: z.array(quoteSchema),

    // TODO(1b): lo que no llegó y lo que se detectó
    // Ambas listas tienen valor por defecto, así que el modelo puede omitirlas
    // y el esquema las rellena con vacío. Una ausencia es un resultado; una
    // lista vacía debería ser una afirmación explícita, no un descuido.
    //
    // Hay una segunda razón, que se descubre al cambiar de proveedor.
    noResponse: z.array(noResponseSchema).default([]),
    anomalies: z.array(anomalySchema).default([]),
    recommendedSupplier: z.string().nullable(),
    rationale: z.string().min(20),
  })
  .refine(
    (comparison) =>
      comparison.quotes.every(
        (quote) =>
          !quote.meetsLeadTime ||
          quote.leadTimeBusinessDays === null ||
          quote.leadTimeBusinessDays <= MAX_LEAD_TIME_BUSINESS_DAYS,
      ),
    {
      message: `Una cotización no puede declararse conforme con un plazo superior a ${MAX_LEAD_TIME_BUSINESS_DAYS} días hábiles`,
      path: ["quotes"],
    },
  );

export type Anomaly = z.infer<typeof anomalySchema>;
export type Quote = z.infer<typeof quoteSchema>;
export type NoResponse = z.infer<typeof noResponseSchema>;
export type Comparison = z.infer<typeof comparisonSchema>;
