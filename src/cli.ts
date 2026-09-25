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

import { runAgent, StepLimitReached } from "./agent.js";
import { runAllChecks } from "./guardrails/checks.js";
import { judgeComparison } from "./guardrails/judge.js";
import { connectCatalog } from "./mcp/client.js";
import { checkToolIntegrity } from "./mcp/integrity.js";
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

/**
 * La segunda capa depende de una llamada a un modelo, que puede fallar por
 * causas ajenas al resultado. Su indisponibilidad se informa y no interrumpe
 * el resto del informe.
 */
async function reportJudgement(comparison: Parameters<typeof judgeComparison>[0]): Promise<string> {
  try {
    return formatJudgement(await judgeComparison(comparison));
  } catch (error) {
    return `\nCAPA 2 · EVALUADOR POR MODELO\n  no disponible: ${(error as Error).message.slice(0, 90)}`;
  }
}

async function main(): Promise<void> {
  if (tracingRequested()) enableTracing();

  // Todo lo que siga a `--` se toma como el encargo. Sin argumentos, el del caso.
  const request = process.argv.slice(2).join(" ");

  const catalog = await connectCatalog();

  try {
    console.log(`\n${formatIntegrity(await checkToolIntegrity(catalog.tools))}\n`);
    console.log("Ejecutando. El modelo decide qué herramientas pedir y en qué orden.");

    const { comparison, usage, denied } = await runAgent(catalog, request);

    console.log(formatUsage(usage));
    console.log(formatComparison(comparison));
    if (denied.length > 0) console.log(formatDenied(denied));
    console.log(formatChecks(runAllChecks(comparison)));
    console.log(await reportJudgement(comparison));
    console.log();
  } catch (error) {
    if (error instanceof StepLimitReached) {
      console.error(`\n  TOPE ALCANZADO: ${error.message}`);
      console.error(`${formatHandoff(error.gathered)}\n`);
      process.exitCode = 2;
      return;
    }
    throw error;
  } finally {
    await catalog.close();
    await shutdownTracing();
  }
}

await main();
