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
import { checkEscalation, runAllChecks } from "./guardrails/checks.js";
import { judgeComparison } from "./guardrails/judge.js";
import { constraintsOf, readBrief } from "./domain/catalog.js";
import { connectCatalog } from "./mcp/client.js";
import { checkToolIntegrity } from "./mcp/integrity.js";
import { recordRun, recordSteps, runId, type RunRecord } from "./platform/runs.js";
import { enableTracing, shutdownTracing, tracingRequested } from "./platform/tracing.js";
import {
  formatChecks,
  formatComparison,
  formatDenied,
  formatEscalation,
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
  const startedAt = Date.now();

  // La bitácora se arma a lo largo de la corrida y se escribe al final, pase lo
  // que pase: una corrida que se cortó en el tope es justamente la que conviene
  // poder mirar después.
  const record: RunRecord = {
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
    const integrity = await checkToolIntegrity(catalog.tools);
    record.integrity = {
      hasBaseline: integrity.hasBaseline,
      added: [...integrity.added],
      removed: [...integrity.removed],
      changed: [...integrity.changed],
    };
    console.log(`\n${formatIntegrity(integrity)}\n`);
    console.log("Ejecutando. El modelo decide qué herramientas pedir y en qué orden.");

    const { outcome, usage, denied, sources } = await runAgent(catalog, request);

    const total = (usage as { usage?: Record<string, number> }).usage ?? {};
    record.outcome = "completa";
    record.steps = recordSteps((usage as { steps?: ReadonlyArray<unknown> }).steps ?? []);
    record.totals = {
      inputTokens: total["inputTokens"] ?? 0,
      outputTokens: total["outputTokens"] ?? 0,
      cachedInputTokens:
        (total as { inputTokenDetails?: { cacheReadTokens?: number } }).inputTokenDetails
          ?.cacheReadTokens ?? 0,
    };
    record.comparison = outcome.comparison;
    record.denied = denied.map((d) => ({ tool: d.tool, input: d.input, reason: d.reason }));

    console.log(formatUsage(usage));
    if (denied.length > 0) console.log(formatDenied(denied));

    // Un resultado que no es un comparativo no se verifica como si lo fuera:
    // las siete comprueban un comparativo y aquí no hay ninguno. Lo que sí se
    // comprueba es que la escalación pida lo que de verdad falta.
    if (outcome.status !== "resolved" || outcome.comparison === null) {
      record.findings = [
        ...checkEscalation(outcome, readBrief() as unknown as Record<string, unknown>),
      ];
      console.log(formatEscalation(outcome));
      console.log(formatChecks(record.findings));
      console.log();
      return;
    }

    const comparison = outcome.comparison;
    record.findings = [...runAllChecks(comparison, sources, constraintsOf(readBrief()))];
    console.log(formatComparison(comparison));
    console.log(formatChecks(record.findings));

    try {
      const verdict = await judgeComparison(comparison);
      record.verdict = verdict;
      console.log(formatJudgement(verdict));
    } catch (error) {
      record.verdictError = (error as Error).message.slice(0, 200);
      console.log(
        `\nCAPA 2 · EVALUADOR POR MODELO\n  no disponible: ${record.verdictError.slice(0, 90)}`,
      );
    }
    console.log();
  } catch (error) {
    if (error instanceof StepLimitReached) {
      record.outcome = "tope-alcanzado";
      record.error = error.message;
      record.steps = error.gathered.map((q, i) => ({
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
    record.error = (error as Error).message.slice(0, 300);
    throw error;
  } finally {
    record.durationMs = Date.now() - startedAt;
    const file = recordRun(record);
    if (file !== null) {
      console.log(`  Corrida registrada en data/runs/.\n`);
    }
    await catalog.close();
    await shutdownTracing();
  }
}

await main();
