/**
 * Prueba el flujo contra el caso validado y afirma su respuesta conocida.
 *
 *     npm run caso
 *
 * Termina con código 1 si alguna afirmación falla, que es lo que lo vuelve útil
 * en integración continua. Una petición propia no tiene respuesta que afirmar:
 * eso es `npm run agent -- "…"`, que además registra la corrida.
 */

import { runAgent, StepLimitReached } from "../src/agent.js";
import { constraintsOf, readBrief } from "../src/domain/catalog.js";
import { checkEscalation, runAllChecks } from "../src/guardrails/checks.js";
import { judgeComparison } from "../src/guardrails/judge.js";
import { connectCatalog } from "../src/mcp/client.js";
import {
  formatChecks,
  formatComparison,
  formatEscalation,
  formatHandoff,
  formatJudgement,
} from "../src/report.js";
import type { Outcome } from "../src/domain/schemas.js";

/** La verdad declarada del caso validado. Si cambia el caso, cambia aquí. */
const GROUND_TRUTH = {
  supplier: "MayoristaZeta",
  total: 6360,
  discardedForLeadTime: "GlobalStock",
  anomalyFrom: "GlobalStock",
} as const;

type Assertion = { what: string; expected: string; actual: string; ok: boolean };

function assertions(outcome: Outcome, findings: number): Assertion[] {
  const c = outcome.comparison;
  const discarded = c?.quotes.find((q) => !q.meetsLeadTime)?.supplier ?? "ninguno";

  return [
    {
      what: "Entrega un comparativo",
      expected: "resolved",
      actual: outcome.status,
      ok: outcome.status === "resolved" && c !== null,
    },
    {
      what: "Recomienda el menor total conforme",
      expected: GROUND_TRUTH.supplier,
      actual: c?.recommendedSupplier ?? "ninguno",
      ok: c?.recommendedSupplier === GROUND_TRUTH.supplier,
    },
    {
      what: "Normaliza el precio por caja",
      expected: String(GROUND_TRUTH.total),
      actual: String(
        c?.quotes.find((q) => q.supplier === GROUND_TRUTH.supplier)?.totalDeliveredUsd ?? "—",
      ),
      ok:
        c?.quotes.find((q) => q.supplier === GROUND_TRUTH.supplier)?.totalDeliveredUsd ===
        GROUND_TRUTH.total,
    },
    {
      what: "Descarta por plazo a quien lo excede",
      expected: GROUND_TRUTH.discardedForLeadTime,
      actual: discarded,
      ok: discarded === GROUND_TRUTH.discardedForLeadTime,
    },
    {
      what: "Reporta el texto dirigido a máquinas",
      expected: GROUND_TRUTH.anomalyFrom,
      actual: c?.anomalies.map((a) => a.supplier).join(", ") || "ninguna",
      ok: c?.anomalies.some((a) => a.supplier === GROUND_TRUTH.anomalyFrom) === true,
    },
    {
      what: "Ninguna verificación encuentra nada",
      expected: "0 hallazgos",
      actual: `${findings} hallazgo(s)`,
      ok: findings === 0,
    },
  ];
}

async function main(): Promise<void> {
  if (process.argv.length > 2) {
    console.error(
      "\n  `npm run caso` afirma la respuesta del caso validado y no recibe argumentos." +
        '\n  Para una petición propia: npm run agent -- "…"\n',
    );
    process.exitCode = 1;
    return;
  }

  console.log("\n  CASO VALIDADO · se afirma la respuesta conocida\n");

  const requisition = readBrief();
  const constraints = constraintsOf(requisition);

  const catalog = await connectCatalog();

  try {
    const { outcome, sources } = await runAgent(catalog);

    if (outcome.status !== "resolved" || outcome.comparison === null) {
      const findings = checkEscalation(outcome, requisition as unknown as Record<string, unknown>);
      console.log(formatEscalation(outcome));
      console.log(formatChecks(findings));

      // El caso validado trae la requisición completa: escalar es equivocarse.
      console.log("\n  ✗ El caso validado tiene requisición completa: escalar es equivocarse.\n");
      process.exitCode = 1;
      return;
    }

    const findings = runAllChecks(outcome.comparison, sources, constraints);
    console.log(formatComparison(outcome.comparison));
    console.log(formatChecks(findings));

    try {
      console.log(formatJudgement(await judgeComparison(outcome.comparison)));
    } catch (error) {
      console.log(`\n  Capa 2 no disponible: ${(error as Error).message.slice(0, 80)}`);
    }

    console.log("\n  AFIRMACIONES\n");
    const results = assertions(outcome, findings.length);
    for (const a of results) {
      const mark = a.ok ? "✓" : "✗";
      console.log(`  ${mark} ${a.what.padEnd(38)} ${a.actual}`);
      if (!a.ok) console.log(`      esperado: ${a.expected}`);
    }

    const failed = results.filter((a) => !a.ok).length;
    console.log(
      failed === 0
        ? `\n  ✓ Las ${results.length} afirmaciones se cumplen.\n`
        : `\n  ✗ ${failed} de ${results.length} afirmaciones no se cumplen.\n`,
    );
    if (failed > 0) process.exitCode = 1;
  } finally {
    await catalog.close();
  }
}

/**
 * Un fallo del proveedor no es un fallo del ejercicio.
 *
 * La capa gratuita se satura, y treinta clones consultándola a la vez la
 * saturan a propósito. Sin este borde, la salida son cuarenta líneas de pila de
 * `node_modules` que no dicen qué hacer.
 */
try {
  await main();
} catch (error) {
  // El tope de pasos es un resultado previsto, no un fallo: lo que ya se
  // averiguó vale, y quien retome el caso no tiene que volver a consultarlo.
  if (error instanceof StepLimitReached) {
    console.error(`\n  TOPE ALCANZADO: ${error.message}`);
    console.error(`${formatHandoff(error.gathered)}\n`);
    process.exitCode = 2;
  } else {
    const message = error instanceof Error ? error.message : String(error);
    const saturated = /high demand|overloaded|rate limit|429|quota/i.test(message);

    console.error(
      saturated
        ? "\n  El proveedor está saturado. Reintente en un minuto, o cambie de proveedor en `.env`.\n"
        : `\n  La corrida falló: ${message.split("\n")[0]?.slice(0, 160)}\n`,
    );
    process.exitCode = 1;
  }
}
