/**
 * El bucle de un agente, sin librería de por medio.
 *
 * Percibir, planificar, actuar, observar, repetir. Unas sesenta líneas que
 * hacen explícito lo que un arnés resuelve por debajo.
 *
 * Opera sobre el mismo catálogo que el servidor MCP expone al agente real:
 * cambia la forma de alcanzarlo, no los datos.
 */

import { readBrief, readQuote } from "./domain/catalog.js";

/** Respuesta final del modelo. Termina el bucle. */
export interface TextReply {
  readonly kind: "text";
  readonly content: string;
}

/** Solicitud del modelo para que se ejecute una herramienta. */
export interface ToolRequest {
  readonly kind: "tool";
  readonly name: string;
  readonly args: Record<string, unknown>;
}

export type Reply = TextReply | ToolRequest;

/** Cualquier cosa que sepa responder: un proveedor real o una grabación. */
export interface Model {
  reply(messages: readonly Message[], schemas: readonly ToolSchema[]): Reply;
}

export interface Message {
  readonly role: "system" | "user" | "agent" | "tool";
  readonly content: string;
}

export interface ToolSchema {
  readonly name: string;
  readonly description: string;
  readonly parameters: Record<string, unknown>;
}

export type ToolImplementation = (args: Record<string, unknown>) => unknown;

/** Un paso registrado del bucle, para inspeccionarlo después. */
export interface TraceEntry {
  readonly step: number;
  readonly reply: Reply;
}

export class StepLimitReached extends Error {}

export interface RunOptions {
  readonly model: Model;
  readonly instructions: string;
  readonly input: string;
  readonly tools: Readonly<Record<string, ToolImplementation>>;
  readonly schemas: readonly ToolSchema[];
  readonly maxSteps?: number;
  readonly trace?: TraceEntry[];
}

/**
 * Corre el ciclo hasta obtener texto o agotar `maxSteps`.
 *
 * `maxSteps` acota el gasto: sin él, un modelo que nunca devuelve texto gira
 * indefinidamente.
 */
export function run(options: RunOptions): string {
  const { model, instructions, input, tools, schemas, maxSteps = 8, trace } = options;

  const messages: Message[] = [
    { role: "system", content: instructions },
    { role: "user", content: input },
  ];

  for (let step = 1; step <= maxSteps; step += 1) {
    // El modelo recibe la conversación completa. No recuerda nada entre
    // llamadas: lo que no esté en `messages` no existe para él.
    const reply = model.reply(messages, schemas);
    trace?.push({ step, reply });

    if (reply.kind === "text") return reply.content;

    // El modelo no ejecuta nada: emite una petición y este código la atiende.
    // Esta tabla delimita lo que el agente puede hacer.
    const implementation = tools[reply.name];
    let result: string;

    if (!implementation) {
      result = `ERROR: la herramienta '${reply.name}' no existe.`;
    } else {
      try {
        result = String(implementation(reply.args));
      } catch (error) {
        // Un fallo de herramienta vuelve como observación, no como excepción,
        // para que el modelo pueda corregir el rumbo.
        result = `ERROR al ejecutar '${reply.name}': ${(error as Error).message}`;
      }
    }

    messages.push({ role: "agent", content: `${reply.name}(${JSON.stringify(reply.args)})` });
    messages.push({ role: "tool", content: result });
  }

  throw new StepLimitReached(`El agente no terminó en ${maxSteps} pasos. Se escala a una persona.`);
}

/** Un turno de una conversación grabada. */
export type RecordedTurn =
  | { readonly kind: "text"; readonly content: string }
  | { readonly kind: "tool"; readonly name: string; readonly args?: Record<string, unknown> };

/**
 * Reproduce una conversación grabada turno por turno.
 *
 * Permite ejecutar el bucle sin red y sin clave, y hace deterministas las
 * pruebas de un sistema que no lo es.
 */
export class RecordedModel implements Model {
  #next = 0;

  constructor(private readonly turns: readonly RecordedTurn[]) {}

  reply(): Reply {
    const turn = this.turns[this.#next];
    if (!turn) {
      throw new Error("La grabación se agotó: el bucle pidió más turnos de los grabados.");
    }
    this.#next += 1;

    return turn.kind === "text"
      ? { kind: "text", content: turn.content }
      : { kind: "tool", name: turn.name, args: turn.args ?? {} };
  }
}

/**
 * Las dos capacidades de consulta, alcanzadas por llamada directa.
 *
 * El servidor MCP expone además `place_order`, que no está aquí: este bucle
 * existe para mostrar el mecanismo, y una acción irreversible necesita la
 * compuerta que el arnés aporta.
 */
export const TOOLS: Readonly<Record<string, ToolImplementation>> = {
  get_brief: () => JSON.stringify(readBrief()),
  get_quote: (args) => readQuote(String(args["supplier"])),
};

export const SCHEMAS: readonly ToolSchema[] = [
  {
    name: "get_brief",
    description: "Restricciones del encargo: cantidad, plazo, presupuesto y criterio.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_quote",
    description: "Texto de la cotización de un proveedor, sin procesar.",
    parameters: {
      type: "object",
      properties: { supplier: { type: "string" } },
      required: ["supplier"],
    },
  },
];
