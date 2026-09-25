/**
 * Pruebas del bucle.
 *
 * Sin `TODO` que completar: verifican que el entorno está bien instalado y
 * documentan el comportamiento del ciclo.
 *
 *     npm test -- loop
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  RecordedModel,
  SCHEMAS,
  StepLimitReached,
  TOOLS,
  run,
  type RecordedTurn,
  type ToolImplementation,
  type TraceEntry,
} from "../src/loop.js";

function recordedTurns(): RecordedTurn[] {
  const raw = readFileSync(new URL("../data/recorded-run.json", import.meta.url), "utf8");
  return (JSON.parse(raw) as { turns: RecordedTurn[] }).turns;
}

/**
 * Envuelve las herramientas reales para registrar las llamadas.
 *
 * Se usan las del catálogo, no sustitutos: así la prueba verifica el bucle
 * contra las mismas capacidades que consume el agente.
 */
function instrumentedTools(): {
  tools: Record<string, ToolImplementation>;
  calls: Array<{ name: string; args: Record<string, unknown> }>;
} {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const tools: Record<string, ToolImplementation> = {};

  for (const [name, implementation] of Object.entries(TOOLS)) {
    tools[name] = (args) => {
      calls.push({ name, args });
      return implementation(args);
    };
  }

  return { tools, calls };
}

describe("run", () => {
  it("corre hasta el turno de texto y devuelve su contenido", () => {
    const { tools } = instrumentedTools();
    const output = run({
      model: new RecordedModel(recordedTurns()),
      instructions: "Compara cotizaciones.",
      input: "Ejecuta el encargo.",
      tools,
      schemas: SCHEMAS,
    });

    expect(output).toContain("MayoristaZeta");
    expect(output).toContain("DESCARTADO");
  });

  it("ejecuta las herramientas que el modelo pide, en orden", () => {
    const { tools, calls } = instrumentedTools();
    run({
      model: new RecordedModel(recordedTurns()),
      instructions: "Compara cotizaciones.",
      input: "Ejecuta el encargo.",
      tools,
      schemas: SCHEMAS,
    });

    expect(calls[0]?.name).toBe("get_brief");
    expect(calls.filter((call) => call.name === "get_quote")).toHaveLength(5);
  });

  it("registra cada paso en la traza", () => {
    const trace: TraceEntry[] = [];
    const { tools } = instrumentedTools();
    run({
      model: new RecordedModel(recordedTurns()),
      instructions: "Compara.",
      input: "Ejecuta.",
      tools,
      schemas: SCHEMAS,
      trace,
    });

    expect(trace).toHaveLength(7);
    expect(trace[0]?.reply.kind).toBe("tool");
    expect(trace.at(-1)?.reply.kind).toBe("text");
  });

  it("se detiene al alcanzar el tope de pasos", () => {
    const endless: RecordedTurn[] = Array.from({ length: 50 }, () => ({
      kind: "tool" as const,
      name: "get_brief",
    }));
    const { tools } = instrumentedTools();

    expect(() =>
      run({
        model: new RecordedModel(endless),
        instructions: "Compara.",
        input: "Ejecuta.",
        tools,
        schemas: SCHEMAS,
        maxSteps: 5,
      }),
    ).toThrow(StepLimitReached);
  });

  it("devuelve un fallo de herramienta como observación, no como excepción", () => {
    const output = run({
      model: new RecordedModel([
        { kind: "tool", name: "get_brief" },
        { kind: "text", content: "No pude consultar el encargo." },
      ]),
      instructions: "Compara.",
      input: "Ejecuta.",
      tools: {
        get_brief: () => {
          throw new Error("la fuente no responde");
        },
      },
      schemas: SCHEMAS,
    });

    expect(output).toContain("No pude");
  });

  it("ignora una herramienta que no está registrada", () => {
    const output = run({
      model: new RecordedModel([
        { kind: "tool", name: "delete_everything" },
        { kind: "text", content: "No pude ejecutar esa acción." },
      ]),
      instructions: "Compara.",
      input: "Ejecuta.",
      tools: TOOLS,
      schemas: SCHEMAS,
    });

    expect(output).toContain("No pude");
  });
});
