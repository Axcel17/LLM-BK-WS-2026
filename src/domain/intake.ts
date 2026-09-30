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
 *
 * Al modelo se le piden datos y razones; el resto lo calcula el código. Si
 * «está completa» se le preguntara a él, podría responder que sí sobre una
 * requisición sin tope, y rechazar el objeto por esa etiqueta desecharía tres
 * campos bien extraídos por una palabra mal puesta.
 */

import { generateText, type LanguageModel, Output } from "ai";
import { z } from "zod";

import { resolveModel } from "../platform/providers.js";
import type { Brief } from "./catalog.js";
import { requisitionFieldSchema } from "./schemas.js";

const RUBRIC = `
Conviertes una petición de compra escrita en prosa en una requisición
estructurada, para un mayorista de equipamiento de oficina.

No inventes lo que no esté. Si la petición no declara un dato, déjalo en null y
explica en 'missing' por qué falta. Un plazo sin unidad, un presupuesto sin
cifra o un producto sin especificar son datos ausentes, no datos que puedas
suponer.

Por cada dato que extraigas, cita en 'citations' el fragmento literal de la
petición del que sale. Si conviertes —una fecha a días hábiles, por ejemplo—
cita el fragmento original, no el resultado.

La garantía tiene valor por omisión: si no se menciona, es la estándar del
proveedor. El plazo se expresa siempre en días hábiles; si la petición lo da en
días calendario o en una fecha, conviértelo y dilo en 'notes'.

El tope se entiende con el flete dentro salvo que la petición diga lo
contrario: pon 'budgetIncludesFreight' en false solo si lo excluye de forma
explícita.

Quien pide no elige a quién se consulta. Si la petición nombra proveedores, no
los tomes como restricción y dilo en 'notes', para que quien la escribió sepa
que se consultará a todo el catálogo.
`.trim();

export const extractionSchema = z.object({
  product: z.string().nullable(),
  quantity: z.number().int().positive().nullable(),
  maxLeadTimeBusinessDays: z.number().int().positive().nullable(),
  budgetCapUsd: z.number().positive().nullable(),

  /**
   * Si el tope incluye el flete o no.
   *
   * Estaba fijo en `true`, y una petición que dijera «tope 7000 sin incluir el
   * flete» producía un encargo que le decía al agente lo contrario de lo que
   * pedía quien escribió. El modelo lo detectaba y lo dejaba en 'notes'; nadie
   * lo leía. No lo comprueba ninguna verificación: gobierna al agente por
   * `get_brief`, y por eso importa que sea el valor correcto.
   */
  budgetIncludesFreight: z.boolean(),

  warranty: z.string().nullable(),

  /**
   * De dónde salió cada dato extraído.
   *
   * Sin esto la extracción no se puede comprobar: un presupuesto inventado y
   * uno leído son indistinguibles. Con la cita, `checkExtraction` contrasta
   * cada valor contra el texto original.
   */
  citations: z.array(
    z.object({
      field: requisitionFieldSchema,
      /**
       * Sin longitud mínima, y no por descuido.
       *
       * Medido con gemini-3.1-flash-lite: cita la cifra desnuda —«40»— donde
       * gpt-5.4-mini cita «40 monitores». Un piso de tres caracteres rechazaba
       * una cita correcta y con ella el objeto entero: siete de dieciséis
       * peticiones morían con «response did not match schema». Cuánto texto
       * hace falta para que algo sea evidencia lo decide quien lo rastrea, en
       * `traceability.ts`, que es donde se compara contra la fuente.
       */
      quotation: z.string().min(1).describe("Fragmento literal de la petición del que sale"),
    }),
  ),

  missing: z.array(
    z.object({
      field: requisitionFieldSchema,
      why: z.string().min(15),
    }),
  ),
  question: z.string().min(15).nullable(),
  notes: z.string().nullable(),
});

type Extraction = z.infer<typeof extractionSchema>;

/** Los cuatro sin los que no hay ronda que consultar. */
const ESSENTIAL = ["product", "quantity", "maxLeadTimeBusinessDays", "budgetCapUsd"] as const;

export type IntakeOutcome = Extraction & { status: "complete" | "missing_information" };

/**
 * Deriva el estado de los datos, y completa lo que el modelo dejó a medias.
 *
 * Un campo nulo que el modelo no enumeró en 'missing' dejaría al llamador con
 * una requisición incompleta y nada que preguntar. El hueco se cierra con el
 * nombre del campo, que es peor explicación que la del modelo pero es una.
 */
export function settle(result: Extraction): IntakeOutcome {
  const absent = ESSENTIAL.filter((field) => result[field] === null);
  if (absent.length === 0) return { ...result, status: "complete", missing: [], question: null };

  const declared = new Map(result.missing.map(({ field, why }) => [field, why]));
  const missing = absent.map((field) => ({
    field,
    why: declared.get(field) ?? "La petición no lo declara.",
  }));

  const fallback =
    absent.length === 1
      ? `Falta declarar ${absent[0]}. ¿Cuál es?`
      : `Faltan declarar ${absent.join(", ")}. ¿Cuáles son?`;

  return {
    ...result,
    status: "missing_information",
    missing,
    question: result.question ?? fallback,
  };
}

/** Convierte el resultado de la admisión en la requisición que consume el agente. */
export function briefFrom(result: IntakeOutcome, suppliers: readonly string[]): Brief {
  const absent = ESSENTIAL.filter((field) => result[field] === null);
  if (absent.length > 0) {
    throw new Error(`Requisición incompleta: falta ${absent.join(", ")}`);
  }

  return {
    product: result.product as string,
    quantity: result.quantity as number,
    maxLeadTimeBusinessDays: result.maxLeadTimeBusinessDays as number,
    budgetCapUsd: result.budgetCapUsd as number,
    budgetIncludesFreight: result.budgetIncludesFreight,
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
  const { output } = await generateText({
    model,
    output: Output.object({ schema: extractionSchema }),
    system: RUBRIC,
    prompt: request,
  });
  return settle(output);
}
