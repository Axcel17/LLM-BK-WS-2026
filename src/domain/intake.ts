/**
 * Admisión: convierte una petición en prosa en una requisición estructurada.
 *
 * Es una llamada aparte, anterior al agente, y eso no es una separación
 * cosmética. Si el agente interpretara la petición y después se verificara
 * contra las restricciones que él mismo declaró, estaría calificando su propio
 * examen: bastaría con declarar un tope alto para que nada lo excediera.
 *
 * Escalar aquí también es más barato. Una requisición sin presupuesto se
 * detiene antes de consultar a cinco proveedores, no después.
 */

import { generateObject, type LanguageModel } from "ai";
import { z } from "zod";

import { resolveModel } from "../platform/providers.js";
import type { Brief } from "./catalog.js";
import { requisitionFieldSchema } from "./schemas.js";

const RUBRIC = `
Conviertes una petición de compra escrita en prosa en una requisición
estructurada, para un mayorista de equipamiento de oficina.

No inventes lo que no esté. Si la petición no declara un dato necesario,
enuméralo en 'missing' y formula una pregunta concreta. Un plazo sin unidad, un
presupuesto sin cifra o un producto sin especificar son datos ausentes, no
datos que puedas suponer.

La garantía tiene valor por omisión: si no se menciona, es la estándar del
proveedor. El plazo se expresa siempre en días hábiles; si la petición lo da en
días calendario o en una fecha, conviértelo y dilo en 'notes'.
`.trim();

const outcome = z
  .object({
    status: z.enum(["complete", "missing_information"]),
    product: z.string().nullable(),
    quantity: z.number().int().positive().nullable(),
    maxLeadTimeBusinessDays: z.number().int().positive().nullable(),
    budgetCapUsd: z.number().positive().nullable(),
    warranty: z.string().nullable(),
    missing: z.array(
      z.object({
        field: requisitionFieldSchema,
        why: z.string().min(15),
      }),
    ),
    question: z.string().min(15).nullable(),
    notes: z.string().nullable(),
  })
  .refine(
    (r) =>
      r.status !== "complete" ||
      (r.product !== null &&
        r.quantity !== null &&
        r.maxLeadTimeBusinessDays !== null &&
        r.budgetCapUsd !== null),
    {
      message: "Una requisición completa exige producto, cantidad, plazo y tope",
      path: ["status"],
    },
  )
  .refine(
    (r) => r.status !== "missing_information" || (r.missing.length > 0 && r.question !== null),
    {
      message: "Declarar que falta información exige enumerar qué falta y preguntarlo",
      path: ["missing"],
    },
  );

export type IntakeOutcome = z.infer<typeof outcome>;

/** Convierte el resultado de la admisión en la requisición que consume el agente. */
export function briefFrom(result: IntakeOutcome, suppliers: readonly string[]): Brief {
  return {
    product: result.product as string,
    quantity: result.quantity as number,
    maxLeadTimeBusinessDays: result.maxLeadTimeBusinessDays as number,
    budgetCapUsd: result.budgetCapUsd as number,
    budgetIncludesFreight: true,
    warranty:
      result.warranty ?? "La estandar del proveedor es suficiente. No se requiere extension.",
    selectionCriterion:
      "Plazo y presupuesto son filtros de descalificacion. Entre las cotizaciones que cumplen " +
      "ambos, se prefiere el menor total puesto en bodega.",
    suppliers: [...suppliers],
  };
}

export async function intake(
  request: string,
  model: LanguageModel = resolveModel("judge"),
): Promise<IntakeOutcome> {
  const { object } = await generateObject({
    model,
    schema: outcome,
    system: RUBRIC,
    prompt: request,
  });
  return object;
}
