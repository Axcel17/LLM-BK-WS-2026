/**
 * Frontera entre el panel y el taller.
 *
 * El panel es un **desplegable aparte**, no una extensión del repositorio: no
 * importa el TypeScript del taller. Se comunica de las tres formas en que se
 * comunican dos sistemas de verdad —protocolo, archivos y procesos— y esa
 * restricción es deliberada, porque es lo que obliga a que no haya dos copias
 * de ninguna decisión:
 *
 *   · **MCP** para las herramientas. El mismo servidor que levanta
 *     `npm run agent`, arrancado como proceso hijo.
 *   · **Archivos** para la política y las bitácoras. `data/instrucciones.md`
 *     son las ocho reglas, y las lee tanto `src/agent.ts` como esto.
 *   · **Procesos** para la evaluación. El panel ejecuta `npm run measure-judge`
 *     y pinta lo que devuelve; no reimplementa el criterio.
 *
 * Si el panel mostrara algo que la terminal no muestra, el panel estaría
 * mintiendo. Todo este módulo es de servidor.
 */

import "server-only";

import { execFile } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { jsonSchema, tool, type ToolSet } from "ai";

const ejecutar = promisify(execFile);

/** La raíz del repositorio, un nivel arriba del panel. */
export const RAIZ = join(process.cwd(), "..");

/* ── Protocolo ─────────────────────────────────────────────────────────── */

export type Catalogo = { tools: ToolSet; close: () => Promise<void> };

/**
 * Levanta el servidor MCP del taller y traduce su catálogo a herramientas.
 *
 * El esquema de entrada sale de lo que el servidor declara y no se reescribe a
 * mano, que es la decisión del `TODO(2)`: una traducción manual pierde
 * argumentos sin que nada falle de forma visible.
 */
export async function conectarCatalogo(): Promise<Catalogo> {
  const cliente = new Client({ name: "panel", version: "1.0.0" });

  await cliente.connect(
    new StdioClientTransport({ command: "npx", args: ["tsx", "src/mcp/server.ts"], cwd: RAIZ }),
  );

  const { tools: declaradas } = await cliente.listTools();
  const tools: ToolSet = {};

  for (const definicion of declaradas) {
    tools[definicion.name] = tool({
      description: definicion.description ?? "",
      inputSchema: jsonSchema(definicion.inputSchema as Parameters<typeof jsonSchema>[0]),
      execute: async (args) => {
        const respuesta = await cliente.callTool({
          name: definicion.name,
          arguments: args as Record<string, unknown>,
        });
        const partes = (respuesta as { content?: Array<{ type: string; text?: string }> }).content;
        return (partes ?? [])
          .filter((p) => p.type === "text")
          .map((p) => p.text ?? "")
          .join("\n");
      },
    });
  }

  return { tools, close: () => cliente.close() };
}

/* ── Archivos ──────────────────────────────────────────────────────────── */

/** Las ocho reglas, del mismo archivo que lee `src/agent.ts`. */
export function instrucciones(): string {
  return readFileSync(join(RAIZ, "data", "instrucciones.md"), "utf8").trim();
}

/** Acciones que el agente no ejecuta por sí mismo. La tabla de `approval.ts`. */
export const HERRAMIENTAS_IRREVERSIBLES = ["place_order"];

export const MOTIVO_DENEGACION =
  "Este agente recomienda, no adjudica. La orden en firme la emite una persona " +
  "con el comparativo a la vista.";

/** Forma de las bitácoras que escribe `src/platform/runs.ts`. */
export type Corrida = {
  id: string;
  startedAt: string;
  durationMs: number;
  provider: string;
  model: string;
  maxSteps: number;
  request: string | null;
  outcome: "completa" | "tope-alcanzado" | "error";
  steps: Array<{
    step: number;
    calls: Array<{ tool: string; input: unknown; preview: string; characters: number }>;
    inputTokens: number | null;
    outputTokens: number | null;
  }>;
  totals: { inputTokens: number; outputTokens: number; cachedInputTokens: number };
  comparison: { recommendedSupplier: string | null; rationale: string } | null;
  findings: Array<{ check: string; detail: string }>;
  verdict: {
    evidenceIsSufficient: boolean;
    rejectionsAreExplained: boolean;
    anomalyIsReported: boolean;
    note: string;
  } | null;
  denied: Array<{ tool: string; input: unknown; reason: string }>;
  error: string | null;
};

/** Lee las bitácoras. El panel las lee; no las produce. */
export function leerCorridas(): Corrida[] {
  const carpeta = join(RAIZ, "data", "runs");
  if (!existsSync(carpeta)) return [];

  return readdirSync(carpeta)
    .filter((archivo) => archivo.endsWith(".json"))
    .map((archivo) => {
      try {
        return JSON.parse(readFileSync(join(carpeta, archivo), "utf8")) as Corrida;
      } catch {
        // Una bitácora corrupta no puede tumbar el panel entero.
        return null;
      }
    })
    .filter((registro): registro is Corrida => registro !== null)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

/* ── Procesos ──────────────────────────────────────────────────────────── */

export type ResultadoCaso = {
  nombre: string;
  aisla: string;
  esperado: Record<string, boolean>;
  acuerdos: number;
  total: number;
  desacuerdos: string[];
};

export type Evaluacion = {
  pasadas: number;
  resultados: ResultadoCaso[];
  acuerdos: number;
  total: number;
};

/**
 * Ejecuta el banco de casos del evaluador.
 *
 * Es literalmente `npm run measure-judge -- N --json`: el mismo comando que
 * corre en la terminal, con el mismo criterio de acuerdo y los mismos casos
 * etiquetados. El panel no lo reimplementa — lo invoca y pinta el resultado.
 */
export async function evaluarEvaluador(pasadas: number): Promise<Evaluacion> {
  const { stdout } = await ejecutar(
    "npm",
    ["run", "--silent", "measure-judge", "--", String(pasadas), "--json"],
    { cwd: RAIZ, maxBuffer: 8 * 1024 * 1024, timeout: 10 * 60 * 1000 },
  );

  // El script imprime una sola línea de JSON; cualquier aviso de npm queda antes.
  const linea = stdout.trim().split("\n").at(-1) ?? "";
  return JSON.parse(linea) as Evaluacion;
}

/** Configuración vigente, para no tener que abrir `.env` para saberla. */
export function configuracion() {
  return {
    proveedor: process.env["PROVIDER"] ?? "google",
    modelo: process.env["MODEL"] ?? "(por defecto del proveedor)",
    evaluador: process.env["JUDGE_MODEL"] ?? process.env["MODEL"] ?? "(el mismo del agente)",
    topeDePasos: Number(process.env["MAX_STEPS"] ?? 12),
    reglaRetirada: process.env["DROP_PROMPT_RULE"] === "1",
  };
}
