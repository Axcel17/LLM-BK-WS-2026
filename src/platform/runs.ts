/**
 * Registro de corridas.
 *
 * Escribe una bitácora, que no es lo mismo que un almacén de estado: el agente
 * nunca la lee de vuelta y cada corrida sigue arrancando en blanco. Sirve para
 * entender qué pasó y para comparar corridas entre sí, que es la única forma de
 * ver el no-determinismo en lugar de creerlo. Lo consume el panel de `panel/`.
 *
 * Registrar nunca puede romper una corrida: todo fallo de escritura se informa.
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { Comparison } from "../domain/schemas.js";
import type { Finding } from "../guardrails/checks.js";
import type { Verdict } from "../guardrails/judge.js";

/**
 * Carpeta de bitácoras.
 *
 * Se resuelve en cada llamada y no al importar el módulo: una ruta congelada en
 * la carga hace que la función no se pueda ejercitar contra una carpeta
 * temporal, y una función de escritura que no se puede probar es una que nadie
 * prueba.
 */
function runsDir(): string {
  return join(process.cwd(), "data", "runs");
}

/** Una llamada a herramienta, con lo que devolvió recortado. */
export type RecordedCall = {
  tool: string;
  input: unknown;
  /** Recortado: el texto completo de cinco cotizaciones no cabe en un visor. */
  preview: string;
  characters: number;
};

export type RecordedStep = {
  step: number;
  calls: RecordedCall[];
  inputTokens: number | null;
  outputTokens: number | null;
};

export type RunRecord = {
  id: string;
  startedAt: string;
  durationMs: number;
  provider: string;
  model: string;
  maxSteps: number;
  /** El encargo que se le dio, o null si se usó el del caso. */
  request: string | null;
  outcome: "completa" | "tope-alcanzado" | "error";
  steps: RecordedStep[];
  totals: { inputTokens: number; outputTokens: number; cachedInputTokens: number };
  comparison: Comparison | null;
  findings: Finding[];
  verdict: Verdict | null;
  verdictError: string | null;
  denied: Array<{ tool: string; input: unknown; reason: string }>;
  integrity: { hasBaseline: boolean; added: string[]; removed: string[]; changed: string[] } | null;
  error: string | null;
};

const PREVIEW_CHARS = 220;

function asText(value: unknown): string {
  // Un resultado ausente son cero caracteres, no la palabra «null»: al cortarse
  // el bucle, el último paso tiene la llamada emitida y el resultado todavía no.
  if (value === undefined || value === null) return "";
  return typeof value === "string" ? value : JSON.stringify(value);
}

/** Traduce los pasos del arnés a algo que un visor pueda pintar. */
export function recordSteps(steps: ReadonlyArray<unknown>): RecordedStep[] {
  return steps.map((raw, index) => {
    const {
      toolCalls = [],
      toolResults = [],
      usage,
    } = raw as {
      toolCalls?: ReadonlyArray<{ toolName: string; input: unknown }>;
      toolResults?: ReadonlyArray<{ output: unknown }>;
      usage?: { inputTokens?: number; outputTokens?: number };
    };

    return {
      step: index + 1,
      calls: toolCalls.map((call, i) => {
        const output = asText(toolResults[i]?.output);
        return {
          tool: call.toolName,
          input: call.input,
          preview: output.slice(0, PREVIEW_CHARS),
          characters: output.length,
        };
      }),
      inputTokens: usage?.inputTokens ?? null,
      outputTokens: usage?.outputTokens ?? null,
    };
  });
}

/**
 * Escribe la bitácora de una corrida.
 *
 * Devuelve la ruta escrita, o `null` si no se pudo escribir. Nunca lanza: una
 * corrida que funcionó no se convierte en una corrida fallida porque el disco
 * esté lleno.
 */
export function recordRun(record: RunRecord): string | null {
  try {
    const folder = runsDir();
    if (!existsSync(folder)) mkdirSync(folder, { recursive: true });
    const file = join(folder, `${record.id}.json`);
    writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`, "utf8");
    return file;
  } catch (error) {
    console.error(`  (no se pudo registrar la corrida: ${(error as Error).message})`);
    return null;
  }
}

/** Identificador ordenable y legible, que es también el nombre del archivo. */
export function runId(date = new Date()): string {
  return date.toISOString().replace(/[:.]/g, "-").replace("Z", "");
}

/**
 * Serializa corridas para incrustarlas dentro de una etiqueta `script`.
 *
 * Un `</script>` dentro de los datos —una cotización que trae HTML, por
 * ejemplo— cerraría la etiqueta antes de tiempo y dejaría la página muda, sin
 * error visible. Escapar `<` es la diferencia entre un visor y una falla
 * silenciosa de las que este taller enseña a no dejar al azar.
 */
export function embedRuns(records: readonly RunRecord[]): string {
  return JSON.stringify(records).replace(/</g, "\\u003c");
}
