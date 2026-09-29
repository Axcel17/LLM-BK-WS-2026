/**
 * Punto de entrada de una corrida.
 *
 * Abre la conexión al catálogo, ejecuta el agente y escribe el resultado. Es
 * la única pieza que conoce a la vez la orquestación y la presentación; todo
 * lo demás depende solo de una de las dos.
 *
 *     npm run agent
 *     npm run agent -- "Compara solo a los proveedores que entregan en 8 días o menos"
 *
 * Sin argumento ejecuta el encargo del caso. Con uno, el agente replantea el
 * plan sobre las mismas herramientas.
 *
 * Variables de entorno reconocidas:
 *
 *     PROVIDER, MODEL              proveedor y modelo del agente
 *     JUDGE_PROVIDER, JUDGE_MODEL  los del evaluador, si difieren
 *     MAX_STEPS                    tope de vueltas del bucle
 *     TRACING                      emite trazas OpenTelemetry
 *     DROP_PROMPT_RULE             retira la regla de no adjudicar
 */

import { maxSteps, runAgent, StepLimitReached } from "./agent.js";
import { runAllChecks } from "./guardrails/checks.js";
import { judgeComparison } from "./guardrails/judge.js";
import { connectCatalog } from "./mcp/client.js";
import { checkToolIntegrity } from "./mcp/integrity.js";
import { recordRun, recordSteps, runId, type RunRecord } from "./platform/runs.js";
import { enableTracing, shutdownTracing, tracingRequested } from "./platform/tracing.js";
import {
  formatChecks,
  formatComparison,
  formatDenied,
  formatHandoff,
  formatIntegrity,
  formatJudgement,
  formatUsage,
} from "./report.js";

async function main(): Promise<void> {
  if (tracingRequested()) enableTracing();

  // Todo lo que siga a `--` se toma como el encargo. Sin argumentos, el del caso.
  const request = process.argv.slice(2).join(" ");

  const catalog = await connectCatalog();
  const comenzó = Date.now();

  // La bitácora se arma a lo largo de la corrida y se escribe al final, pase lo
  // que pase: una corrida que se cortó en el tope es justamente la que conviene
  // poder mirar después.
  const bitácora: RunRecord = {
    id: runId(),
    startedAt: new Date().toISOString(),
    durationMs: 0,
    provider: process.env["PROVIDER"] ?? "google",
    model: process.env["MODEL"] ?? "(por defecto del proveedor)",
    maxSteps: maxSteps(),
    request: request.trim() === "" ? null : request,
    outcome: "error",
    steps: [],
    totals: { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0 },
    comparison: null,
    findings: [],
    verdict: null,
    verdictError: null,
    denied: [],
    integrity: null,
    error: null,
  };

  try {
    const integridad = await checkToolIntegrity(catalog.tools);
    bitácora.integrity = {
      hasBaseline: integridad.hasBaseline,
      added: [...integridad.added],
      removed: [...integridad.removed],
      changed: [...integridad.changed],
    };
    console.log(`\n${formatIntegrity(integridad)}\n`);
    console.log("Ejecutando. El modelo decide qué herramientas pedir y en qué orden.");

    const { comparison, usage, denied } = await runAgent(catalog, request);

    const total = (usage as { usage?: Record<string, number> }).usage ?? {};
    bitácora.outcome = "completa";
    bitácora.steps = recordSteps((usage as { steps?: ReadonlyArray<unknown> }).steps ?? []);
    bitácora.totals = {
      inputTokens: total["inputTokens"] ?? 0,
      outputTokens: total["outputTokens"] ?? 0,
      cachedInputTokens:
        (total as { inputTokenDetails?: { cacheReadTokens?: number } }).inputTokenDetails
          ?.cacheReadTokens ?? 0,
    };
    bitácora.comparison = comparison;
    bitácora.denied = denied.map((d) => ({ tool: d.tool, input: d.input, reason: d.reason }));
    bitácora.findings = [...runAllChecks(comparison)];

    console.log(formatUsage(usage));
    console.log(formatComparison(comparison));
    if (denied.length > 0) console.log(formatDenied(denied));
    console.log(formatChecks(bitácora.findings));

    try {
      const veredicto = await judgeComparison(comparison);
      bitácora.verdict = veredicto;
      console.log(formatJudgement(veredicto));
    } catch (error) {
      bitácora.verdictError = (error as Error).message.slice(0, 200);
      console.log(
        `\nCAPA 2 · EVALUADOR POR MODELO\n  no disponible: ${bitácora.verdictError.slice(0, 90)}`,
      );
    }
    console.log();
  } catch (error) {
    if (error instanceof StepLimitReached) {
      bitácora.outcome = "tope-alcanzado";
      bitácora.error = error.message;
      bitácora.steps = error.gathered.map((q, i) => ({
        step: i + 1,
        calls: [{ tool: q.tool, input: q.input, preview: "", characters: q.characters }],
        inputTokens: null,
        outputTokens: null,
      }));
      console.error(`\n  TOPE ALCANZADO: ${error.message}`);
      console.error(`${formatHandoff(error.gathered)}\n`);
      process.exitCode = 2;
      return;
    }
    bitácora.error = (error as Error).message.slice(0, 300);
    throw error;
  } finally {
    bitácora.durationMs = Date.now() - comenzó;
    const archivo = recordRun(bitácora);
    if (archivo !== null) {
      console.log(`  Corrida registrada en data/runs/.\n`);
    }
    await catalog.close();
    await shutdownTracing();
  }
}

await main();
