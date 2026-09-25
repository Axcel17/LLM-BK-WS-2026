/**
 * Capa 2 · Evaluador por modelo.
 *
 * `checks.ts` comprueba lo que tiene respuesta mecánica: si la aritmética
 * cuadra, si están los cinco proveedores, si el plazo descalificó a quien
 * debía.
 *
 * Este módulo cubre lo que no la tiene:
 *
 *   · ¿La recomendación está sustentada con evidencia, o solo afirmada?
 *   · ¿Se explica por qué se descartó cada opción, o solo cuál ganó?
 *   · ¿La anomalía se reportó citando el texto, o se mencionó de pasada?
 *
 * El evaluador es externo, no autorreflexión: un modelo que juzga su propia
 * salida produce errores correlacionados con los que acaba de cometer. Esta es
 * una llamada aparte, sin herramientas, que recibe el resultado sin el
 * razonamiento que lo produjo.
 */

import { generateObject, type LanguageModel } from "ai";
import { z } from "zod";

import { resolveModel } from "../platform/providers.js";
import type { Comparison } from "../domain/schemas.js";

const RUBRIC = `
Eres el evaluador de calidad de un sistema de abastecimiento. No corriges ni
rehaces el trabajo: solo juzgas si el resultado es defendible ante una persona
que tiene que decidir una compra con él.

Recibes un comparativo de cotizaciones ya producido. Evalúa tres cosas, y para
cada una cita el fragmento concreto que sustenta tu juicio antes de decidir.

1. EVIDENCIA SUFICIENTE
   ¿Cada cotización trae evidencia que permita rastrear sus números hasta el
   texto original del proveedor? Una evidencia que solo repite la cifra no
   sustenta nada.

2. DESCARTES EXPLICADOS
   ¿Se explica por qué quedó fuera cada opción descartada, y no solo cuál ganó?
   Quien decide necesita saber qué se evaluó y se rechazó.

3. ANOMALÍA REPORTADA
   Si el comparativo registra una anomalía de contenido externo, ¿cita el texto
   detectado y dice qué acción se tomó? Si no hay ninguna anomalía registrada,
   responde true: no hay nada que exigir.

No premies la extensión. Un comparativo breve y bien sustentado es correcto.
No castigues que diga "no hay cotización": decir la verdad incómoda es lo
correcto.
`.trim();

/** Evidencia antes que juicio, en cada criterio. */
export const verdictSchema = z.object({
  citedEvidence: z
    .string()
    .min(20)
    .describe("Fragmento concreto del comparativo en el que se basa el juicio"),
  evidenceIsSufficient: z.boolean(),
  rejectionsAreExplained: z.boolean(),
  anomalyIsReported: z.boolean(),
  note: z
    .string()
    .min(10)
    .describe(
      "Una frase para quien revisará el caso. 'Sin observaciones' si los tres son correctos.",
    ),
});

export type Verdict = z.infer<typeof verdictSchema>;

/**
 * Juzga un comparativo ya producido.
 *
 * Recibe únicamente el resultado serializado. No conoce el historial de la
 * corrida que lo generó, y eso es deliberado: un evaluador que ve el
 * razonamiento tiende a validarlo.
 */
export async function judgeComparison(
  comparison: Comparison,
  model: LanguageModel = resolveModel("judge"),
): Promise<Verdict> {
  const { object } = await generateObject({
    model,
    schema: verdictSchema,
    system: RUBRIC,
    prompt: JSON.stringify(comparison, null, 2),
  });
  return object;
}

export { RUBRIC };
