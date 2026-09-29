/**
 * Agente de abastecimiento.
 *
 * Consulta el catálogo por MCP, normaliza las cotizaciones, las evalúa contra
 * las restricciones del encargo y produce un comparativo validado.
 *
 * Este módulo devuelve datos y no imprime nada: la presentación vive en
 * `report.ts` y el punto de entrada en `cli.ts`. Esa separación permite
 * verificar el resultado de una corrida sin capturar texto de consola.
 *
 * Variables de entorno reconocidas:
 *
 *     PROVIDER, MODEL              proveedor y modelo del agente
 *     MAX_STEPS                    tope de vueltas del bucle
 *     DROP_PROMPT_RULE             retira la regla de no adjudicar
 */

import { readFileSync } from "node:fs";

import { Experimental_Agent as Agent, NoOutputGeneratedError, Output, stepCountIs } from "ai";

import { makeOutcomeSchema, type Outcome } from "./domain/schemas.js";
import { constraintsOf, readBrief } from "./domain/catalog.js";
import { createApprovalGate, type DeniedCall } from "./guardrails/approval.js";
import type { CatalogConnection } from "./mcp/client.js";
import { resolveModel } from "./platform/providers.js";
import { tracingRequested } from "./platform/tracing.js";

/**
 * La política del agente vive en `data/instrucciones.md`, no en este archivo.
 *
 * Es la misma idea que la Parte 1: una instrucción guardada se versiona, se
 * comparte y se lee desde varios sitios. Aquí lo concreto es que el panel de
 * `panel/` la consume del mismo archivo — si viviera dentro de este módulo,
 * habría dos copias de las ocho reglas y una empezaría a mentir.
 */
const INSTRUCTIONS = readFileSync(
  new URL("../data/instrucciones.md", import.meta.url),
  "utf8",
).trim();

/**
 * Tope por defecto.
 *
 * El encargo y las cinco cotizaciones son seis llamadas; el doble deja margen
 * para los reintentos ante un fallo de validación y para el paso que emite la
 * salida estructurada. Con menos, el corte se vuelve el resultado habitual en
 * lugar de la excepción que hace visible el gasto.
 */
const DEFAULT_MAX_STEPS = 12;

/**
 * Tope de vueltas del bucle, leído del entorno.
 *
 * Se valida en lugar de convertirse sin más. `Number("doce")` da `NaN`, y
 * `stepCountIs(NaN)` no se cumple nunca: una errata en `.env` dejaría el bucle
 * sin tope y sin que nada lo indicara. Es el modo de falla que el propio tope
 * existe para evitar.
 */
export function maxSteps(valor = process.env["MAX_STEPS"]): number {
  if (valor === undefined || valor.trim() === "") return DEFAULT_MAX_STEPS;

  const pasos = Number(valor);
  if (!Number.isInteger(pasos) || pasos < 1) {
    throw new Error(`MAX_STEPS debe ser un entero positivo. Recibido: ${JSON.stringify(valor)}`);
  }
  return pasos;
}

/**
 * Variante que retira del prompt la regla de no adjudicar y pide cerrar la
 * compra.
 *
 * Existe para hacer visible la diferencia entre los dos umbrales. Con la regla
 * puesta, el modelo no intenta emitir la orden y la compuerta no se nota. Sin
 * ella, la intenta — y la compuerta la deniega igual, porque no depende de que
 * el modelo colabore.
 *
 *     DROP_PROMPT_RULE=1 npm run agent
 */
function dropsPromptRule(): boolean {
  return process.env["DROP_PROMPT_RULE"] === "1";
}

export function buildInstructions(): string {
  if (!dropsPromptRule()) return INSTRUCTIONS;
  return INSTRUCTIONS.replace(/\n8\. No adjudicas\.[\s\S]*$/, "").trim();
}

/**
 * El encargo que se le plantea al agente.
 *
 * Admite un texto propio. Nada en este módulo describe una secuencia de pasos:
 * el modelo decide qué herramientas pedir, en qué orden y cuándo detenerse, de
 * modo que un encargo distinto produce un plan distinto con las mismas
 * herramientas.
 *
 * El contrato de salida sí es el de este caso. Un encargo que pida algo de otra
 * forma se validará igual contra `comparisonSchema`, y ahí se ve dónde termina
 * la flexibilidad de un agente con salida estructurada.
 */
export function buildTask(request?: string): string {
  const custom = request?.trim();
  if (custom) return custom;

  return dropsPromptRule()
    ? "Ejecuta el encargo de reposición urgente y deja la compra cerrada con el mejor proveedor."
    : "Ejecuta el encargo de reposición urgente.";
}

/** Una consulta que el agente completó antes de detenerse. */
export interface CompletedQuery {
  readonly tool: string;
  readonly input: unknown;
  readonly characters: number;
}

/**
 * El bucle agotó su tope de pasos antes de producir un resultado.
 *
 * Lleva consigo lo ya averiguado. Escalar un caso sin ese contexto obliga a
 * quien lo recibe a rehacer la investigación desde cero.
 */
export class StepLimitReached extends Error {
  constructor(
    readonly steps: number,
    readonly gathered: readonly CompletedQuery[],
  ) {
    super(
      `El agente no produjo un resultado en ${steps} pasos. La ejecución se ` +
        `detuvo antes de seguir gastando.`,
    );
    this.name = "StepLimitReached";
  }
}

/**
 * Reconstruye las consultas que alcanzaron a completarse.
 *
 * Dentro de un paso, la llamada y su resultado comparten posición: la primera
 * herramienta pedida es la primera respondida.
 */
export function gatheredSoFar(steps: ReadonlyArray<unknown>): CompletedQuery[] {
  const queries: CompletedQuery[] = [];

  for (const step of steps) {
    const { toolCalls = [], toolResults = [] } = step as {
      toolCalls?: ReadonlyArray<{ toolName: string; input: unknown }>;
      toolResults?: ReadonlyArray<{ output: unknown }>;
    };

    for (const [index, call] of toolCalls.entries()) {
      const output = toolResults[index]?.output;
      queries.push({
        tool: call.toolName,
        input: call.input,
        characters: typeof output === "string" ? output.length : 0,
      });
    }
  }

  return queries;
}

/**
 * Lo que devolvió cada consulta de cotización, por proveedor.
 *
 * Quien hizo las llamadas es quien tiene que devolver lo que devolvieron:
 * `checkEvidence` las necesita para contrastar lo declarado contra la fuente, y
 * reconstruirlas después, fuera de aquí, sería adivinar.
 */
export function quotedSources(steps: ReadonlyArray<unknown>): Map<string, string> {
  const sources = new Map<string, string>();

  for (const step of steps) {
    const { toolCalls = [], toolResults = [] } = step as {
      toolCalls?: ReadonlyArray<{ toolName: string; input: unknown }>;
      toolResults?: ReadonlyArray<{ output: unknown }>;
    };

    for (const [index, call] of toolCalls.entries()) {
      if (call.toolName !== "get_quote") continue;
      const supplier = (call.input as { supplier?: unknown } | null)?.supplier;
      const output = toolResults[index]?.output;
      if (typeof supplier === "string" && typeof output === "string") {
        sources.set(supplier, output);
      }
    }
  }

  return sources;
}

/** Resultado de una corrida: el comparativo, lo que costó, lo que se detuvo y lo que se leyó. */
export interface AgentRun {
  readonly outcome: Outcome;
  readonly usage: { steps?: ReadonlyArray<{ usage: unknown }>; usage: unknown };
  readonly denied: readonly DeniedCall[];
  readonly sources: ReadonlyMap<string, string>;
}

export async function runAgent(catalog: CatalogConnection, request?: string): Promise<AgentRun> {
  const steps = maxSteps();
  const gate = createApprovalGate();

  const agent = new Agent({
    model: resolveModel("agent"),
    instructions: buildInstructions(),
    tools: catalog.tools,
    stopWhen: stepCountIs(steps),
    output: Output.object({ schema: makeOutcomeSchema(constraintsOf(readBrief())) }),
    telemetry: { isEnabled: tracingRequested() },
    // El arnés consulta la compuerta antes de ejecutar cualquier herramienta.
    // Lo que aquí se deniegue no se ejecuta, decida lo que decida el modelo.
    toolApproval: gate.decide,
  });

  const result = await agent.generate({ prompt: buildTask(request) });

  try {
    return {
      outcome: result.output as Outcome,
      usage: result,
      denied: gate.denied,
      sources: quotedSources(result.steps ?? []),
    };
  } catch (error) {
    // `stopWhen` corta el bucle pero no produce salida estructurada: el
    // resultado queda sin `output` y leerlo lanza. El tope funcionó; lo que
    // falta es decirlo con claridad.
    if (NoOutputGeneratedError.isInstance(error)) {
      throw new StepLimitReached(steps, gatheredSoFar(result.steps ?? []));
    }
    throw error;
  }
}
