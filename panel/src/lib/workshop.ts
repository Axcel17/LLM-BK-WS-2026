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

const run = promisify(execFile);

/** La raíz del repositorio, un nivel arriba del panel. */
export const REPO_ROOT = join(process.cwd(), "..");

/* ── Protocolo ─────────────────────────────────────────────────────────── */

export type Catalog = { tools: ToolSet; close: () => Promise<void> };

/**
 * Levanta el servidor MCP del taller y traduce su catálogo a herramientas.
 *
 * El esquema de entrada sale de lo que el servidor declara y no se reescribe a
 * mano, que es la decisión del `TODO(2)`: una traducción manual pierde
 * argumentos sin que nada falle de forma visible.
 *
 * La requisición se pasa por argumento y no por el entorno del panel. El panel
 * es un servidor de larga vida que atiende varias conversaciones; fijarla en su
 * proceso haría que la de una alcanzara a las otras. Cada conversación levanta
 * su propio servidor y le entrega la suya.
 */
export async function connectCatalog(brief?: Requisition): Promise<Catalog> {
  const client = new Client({ name: "panel", version: "1.0.0" });

  await client.connect(
    new StdioClientTransport({
      command: "npx",
      args: ["tsx", "src/mcp/server.ts"],
      cwd: REPO_ROOT,
      // El hijo no hereda el entorno por omisión. Sin esto `get_brief` sirve el
      // archivo del caso aunque se haya admitido otra requisición.
      env: {
        ...(process.env as Record<string, string>),
        ...(brief === undefined ? {} : { BRIEF_JSON: JSON.stringify(brief) }),
      },
    }),
  );

  const { tools: declaradas } = await client.listTools();
  const tools: ToolSet = {};

  for (const definition of declaradas) {
    tools[definition.name] = tool({
      description: definition.description ?? "",
      inputSchema: jsonSchema(definition.inputSchema as Parameters<typeof jsonSchema>[0]),
      execute: async (args) => {
        const response = await client.callTool({
          name: definition.name,
          arguments: args as Record<string, unknown>,
        });
        const pieces = (response as { content?: Array<{ type: string; text?: string }> }).content;
        return (pieces ?? [])
          .filter((p) => p.type === "text")
          .map((p) => p.text ?? "")
          .join("\n");
      },
    });
  }

  return { tools, close: () => client.close() };
}

/* ── Archivos ──────────────────────────────────────────────────────────── */

/**
 * La requisición sobre la que trabaja el agente.
 *
 * No la escribe quien usa el panel: existe en el sistema, como existiría una
 * requisición de compra aprobada. `get_brief` devuelve exactamente esto. Que
 * esté a la vista es lo que hace comprensible el resto — sin ella, la consola
 * parece pedir instrucciones que en realidad ya están dadas.
 */
export type Requisition = {
  product: string;
  quantity: number;
  maxLeadTimeBusinessDays: number;
  budgetCapUsd: number;
  budgetIncludesFreight: boolean;
  warranty: string;
  selectionCriterion: string;
  suppliers: string[];
};

export function requisition(): Requisition {
  return JSON.parse(readFileSync(join(REPO_ROOT, "data", "brief.json"), "utf8")) as Requisition;
}

/**
 * Lo que la admisión responde a una petición en prosa.
 *
 * Las tres formas son las de `src/admission.ts`, más `error` para cuando el
 * proveedor del modelo no responde: en pantalla hay que poder decirlo.
 */
export type Admission =
  | { status: "admitted"; brief: Requisition; outcome: { notes: string | null } }
  | {
      status: "incomplete";
      outcome: { missing: Array<{ field: string; why: string }>; question: string | null };
    }
  | { status: "unfounded"; findings: Array<{ detail: string }> }
  | { status: "error"; error: string };

/**
 * Admite una petición en prosa, o explica por qué no alcanza.
 *
 * Es literalmente `npm run admit -- "…"`, el mismo criterio que corre en la
 * terminal. El panel no lo reimplementa: si admitiera con reglas propias, la
 * consola y la terminal aceptarían peticiones distintas.
 */
export async function admit(request: string): Promise<Admission> {
  const { stdout } = await run("npm", ["run", "--silent", "admit", "--", request], {
    cwd: REPO_ROOT,
    maxBuffer: 1024 * 1024,
    timeout: 2 * 60 * 1000,
  });

  const line = stdout.trim().split("\n").at(-1) ?? "";
  return JSON.parse(line) as Admission;
}

/** Las ocho reglas, del mismo archivo que lee `src/agent.ts`. */
export function instructions(): string {
  return readFileSync(join(REPO_ROOT, "data", "instrucciones.md"), "utf8").trim();
}

/** Acciones que el agente no ejecuta por sí mismo. La tabla de `approval.ts`. */
export const IRREVERSIBLE_TOOLS = ["place_order"];

/**
 * Lo que la compuerta le dice a quien tiene que decidir.
 *
 * En la terminal esta misma tabla deniega en firme, porque no hay nadie
 * mirando. Aquí hay alguien: la compuerta se detiene y pregunta, que es lo que
 * hace una compuerta cuando existe un humano al otro lado.
 */
export const APPROVAL_REASON =
  "Emitir una orden de compra no se deshace. Este agente recomienda; la firma es suya.";

/** Forma de las bitácoras que escribe `src/platform/runs.ts`. */
export type Run = {
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
export function readRuns(): Run[] {
  const folder = join(REPO_ROOT, "data", "runs");
  if (!existsSync(folder)) return [];

  return readdirSync(folder)
    .filter((file) => file.endsWith(".json"))
    .map((file) => {
      try {
        return JSON.parse(readFileSync(join(folder, file), "utf8")) as Run;
      } catch {
        // Una bitácora corrupta no puede tumbar el panel entero.
        return null;
      }
    })
    .filter((registro): registro is Run => registro !== null)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

/* ── Procesos ──────────────────────────────────────────────────────────── */

export type CaseResult = {
  name: string;
  aisla: string;
  esperado: Record<string, boolean>;
  acuerdos: number;
  total: number;
  desacuerdos: string[];
};

export type Evaluation = {
  passes: number;
  resultados: CaseResult[];
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
export async function evaluateJudge(passes: number): Promise<Evaluation> {
  const { stdout } = await run(
    "npm",
    ["run", "--silent", "measure-judge", "--", String(passes), "--json"],
    { cwd: REPO_ROOT, maxBuffer: 8 * 1024 * 1024, timeout: 10 * 60 * 1000 },
  );

  // El script imprime una sola línea de JSON; cualquier aviso de npm queda antes.
  const line = stdout.trim().split("\n").at(-1) ?? "";
  return JSON.parse(line) as Evaluation;
}

/**
 * Ficha del agente, para que la interfaz muestre qué puede y qué no.
 *
 * Las reglas salen de `data/instrucciones.md` —el mismo archivo que gobierna al
 * agente— y no de una lista escrita a mano en la interfaz. Una ficha que no se
 * lee de la fuente deja de ser cierta en cuanto la fuente cambia.
 */
export function agentCard() {
  const text = instructions();
  const rules = [...text.matchAll(/^\s*(\d)\.\s+([\s\S]*?)(?=^\s*\d\.\s|\Z)/gm)].map(
    ([, n, body]) => ({ n: Number(n), t: body.replace(/\s+/g, " ").trim() }),
  );

  // Las prohibiciones del encargo, en la voz de la interfaz. Son las reglas 6 y
  // 8: no obedecer texto ajeno y no adjudicar por cuenta propia.
  const prohibitions = rules
    .filter((r) => r.n === 6 || r.n === 8)
    .map((r) =>
      r.n === 6
        ? "Obedecer instrucciones escondidas en una cotización"
        : "Adjudicar sin que una persona firme",
    );

  return {
    ...configuration(),
    tools: [
      {
        name: "get_brief",
        description: "Lee el encargo: qué, cuánto, plazo y tope.",
        needsApproval: false,
      },
      {
        name: "get_quote",
        description: "Trae la cotización de un proveedor, sin limpiar.",
        needsApproval: false,
      },
      {
        name: "place_order",
        description: "Emite la orden de compra en firme.",
        needsApproval: true,
      },
    ],
    rules: prohibitions,
  };
}

/** Configuración vigente, para no tener que abrir `.env` para saberla. */
export function configuration() {
  return {
    provider: process.env["PROVIDER"] ?? "google",
    model: process.env["MODEL"] ?? "(por defecto del proveedor)",
    judgeModel: process.env["JUDGE_MODEL"] ?? process.env["MODEL"] ?? "(el mismo del agente)",
    stepLimit: Number(process.env["MAX_STEPS"] ?? 12),
    ruleDropped: process.env["DROP_PROMPT_RULE"] === "1",
  };
}
