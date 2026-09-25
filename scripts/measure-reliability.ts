/**
 * Mide la fiabilidad del flujo.
 *
 * Corre el agente N veces y cuenta cuántas producen salida válida y cuántas
 * pasan las verificaciones. Es la diferencia entre "lo probé y anduvo" y
 * "acierta 7 de cada 10, y los tres fallos son de este tipo".
 *
 * Con ese número se decide dónde va la compuerta de aprobación.
 *
 *     npx tsx --env-file=.env scripts/measure-reliability.ts 8
 *
 * El proveedor y el modelo se toman del entorno.
 */

import { runAgent } from "../src/agent.js";
import { runAllChecks } from "../src/guardrails/checks.js";
import { connectCatalog } from "../src/mcp/client.js";

/** Respuesta correcta del caso, para distinguir validez de acierto. */
const EXPECTED_SUPPLIER = "MayoristaZeta";

const runs = Number(process.argv[2] ?? 8);

let valid = 0;
let correct = 0;
const durations: number[] = [];

const catalog = await connectCatalog();

try {
  for (let attempt = 1; attempt <= runs; attempt += 1) {
    const startedAt = Date.now();
    try {
      const { comparison } = await runAgent(catalog);
      const seconds = (Date.now() - startedAt) / 1000;
      durations.push(seconds);
      valid += 1;

      const findings = runAllChecks(comparison);
      const isCorrect =
        comparison.recommendedSupplier === EXPECTED_SUPPLIER && findings.length === 0;
      if (isCorrect) correct += 1;

      console.log(
        `  ${String(attempt).padStart(2)}. válida  ${seconds.toFixed(1).padStart(5)}s  ` +
          `rec=${(comparison.recommendedSupplier ?? "ninguno").padEnd(18)} ` +
          `hallazgos=${findings.length}  ${isCorrect ? "CORRECTA" : "incorrecta"}`,
      );
      for (const finding of findings) console.log(`        [${finding.check}] ${finding.detail}`);
    } catch (error) {
      console.log(
        `  ${String(attempt).padStart(2)}. FALLA   ${(error as Error).message.slice(0, 80)}`,
      );
    }
  }
} finally {
  await catalog.close();
}

console.log(`\n  válidas: ${valid}/${runs}   correctas: ${correct}/${runs}`);

if (durations.length > 0) {
  const sorted = [...durations].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
  console.log(
    `  tiempo: ${sorted[0]?.toFixed(1)}–${sorted.at(-1)?.toFixed(1)}s (mediana ${median.toFixed(1)}s)`,
  );
}
