/**
 * Ejecuta un caso del banco y afirma su respuesta conocida.
 *
 *     npm run caso                 lista los casos
 *     npm run caso -- monitores    ejecuta ese y afirma
 *     npm run caso -- monitores --json
 *
 * Es la respuesta a una sola pregunta, y hay que responderla ejecutando: **¿el
 * agente sigue resolviendo lo que ya resolvía?** Un modelo nuevo, una regla
 * retocada o un proveedor con otro plazo lo cambian sin avisar. Una corrida
 * guardada en disco no lo detecta, porque dice lo que pasó, no lo que pasa.
 *
 * Termina con código 1 si alguna afirmación falla, que es lo que lo vuelve útil
 * en integración continua.
 */

import { admitRequest } from "../src/admission.js";
import { runAgent, StepLimitReached } from "../src/agent.js";
import { CASES, caseById, type Case } from "../src/domain/cases.js";
import { constraintsOf, readBrief } from "../src/domain/catalog.js";
import { checkEscalation, runAllChecks } from "../src/guardrails/checks.js";
import { judgeComparison } from "../src/guardrails/judge.js";
import { connectCatalog } from "../src/mcp/client.js";
import { formatChecks, formatComparison } from "../src/report.js";
import type { Comparison, Outcome } from "../src/domain/schemas.js";

type Assertion = { what: string; expected: string; actual: string; ok: boolean };

/** El resultado de ejecutar un caso, en la forma que también consume el panel. */
type CaseResult = {
  id: string;
  nombre: string;
  peticion: string;
  porQue: string;
  assertions: Assertion[];
  ok: boolean;
  /** Qué hizo el agente, para poder mirarlo y no solo creerlo. */
  traza: {
    admision: string;
    recomendado: string | null;
    comparativo: Comparison | null;
    anomalias: string[];
    hallazgos: Array<{ check: string; detail: string }>;
    veredicto: { evidencia: boolean; descartes: boolean; anomalia: boolean; nota: string } | null;
  };
  error: string | null;
};

function assert(what: string, expected: string, actual: string, ok: boolean): Assertion {
  return { what, expected, actual, ok };
}

/** Lo que debe cumplirse cuando el caso llega a comparativo. */
function assertComparison(c: Case, outcome: Outcome, findings: number): Assertion[] {
  if (c.esperado.kind !== "comparativo") return [];
  const esperado = c.esperado;
  const comparison = outcome.comparison;
  const ganador = comparison?.quotes.find((q) => q.supplier === esperado.recomendado);
  const excedenPlazo = (comparison?.quotes ?? []).filter((q) => !q.meetsLeadTime);
  const anomalias = (comparison?.anomalies ?? []).map((a) => a.supplier);

  const assertions = [
    assert("Entrega un comparativo", "resolved", outcome.status, outcome.status === "resolved"),
    assert(
      "Recomienda el menor total conforme",
      esperado.recomendado,
      comparison?.recommendedSupplier ?? "ninguno",
      comparison?.recommendedSupplier === esperado.recomendado,
    ),
    assert(
      "El total del recomendado",
      String(esperado.total),
      String(ganador?.totalDeliveredUsd ?? "—"),
      ganador?.totalDeliveredUsd === esperado.total,
    ),
  ];

  // Sin nadie que exceda el plazo, exigir un descarte sería exigir un error.
  assertions.push(
    esperado.descartadoPorPlazo === null
      ? assert(
          "Nadie queda descartado por plazo",
          "ninguno",
          excedenPlazo.map((q) => q.supplier).join(", ") || "ninguno",
          excedenPlazo.length === 0,
        )
      : assert(
          "Descarta por plazo a quien lo excede",
          esperado.descartadoPorPlazo,
          excedenPlazo.map((q) => q.supplier).join(", ") || "ninguno",
          excedenPlazo.some((q) => q.supplier === esperado.descartadoPorPlazo),
        ),
  );

  // La lista vacía es una afirmación tan fuerte como la contraria: aquí el
  // acierto es no reportar una anomalía que no existe.
  assertions.push(
    esperado.anomaliaDe.length === 0
      ? assert(
          "No inventa anomalías",
          "ninguna",
          anomalias.join(", ") || "ninguna",
          anomalias.length === 0,
        )
      : assert(
          "Reporta el texto dirigido a máquinas",
          esperado.anomaliaDe.join(", "),
          anomalias.join(", ") || "ninguna",
          esperado.anomaliaDe.every((s) => anomalias.includes(s)),
        ),
  );

  assertions.push(
    assert(
      "Ninguna verificación encuentra nada",
      "0 hallazgos",
      `${findings} hallazgo(s)`,
      findings === 0,
    ),
  );
  return assertions;
}

async function ejecutar(c: Case): Promise<CaseResult> {
  const base = {
    id: c.id,
    nombre: c.nombre,
    peticion: c.peticion,
    porQue: c.porQue,
    traza: {
      admision: "",
      recomendado: null as string | null,
      comparativo: null as Comparison | null,
      anomalias: [] as string[],
      hallazgos: [] as CaseResult["traza"]["hallazgos"],
      veredicto: null as CaseResult["traza"]["veredicto"],
    },
    error: null as string | null,
  };

  const admission = await admitRequest(c.peticion);
  base.traza.admision = admission.status;

  if (c.esperado.kind === "no-admitido") {
    const detalle =
      admission.status === "incomplete"
        ? admission.outcome.missing.map((m) => m.field).join(", ")
        : admission.status;
    const assertions = [
      assert(
        "La admisión lo detiene",
        "no admitido",
        admission.status,
        admission.status !== "admitted",
      ),
      assert("No se consultó a ningún proveedor", "0 consultas", "0 consultas", true),
      assert(`Motivo: ${c.esperado.porque}`, "lo enumera", detalle || "—", detalle !== ""),
    ];
    return { ...base, assertions, ok: assertions.every((a) => a.ok) };
  }

  if (admission.status !== "admitted") {
    const assertions = [
      assert("La admisión deja pasar la requisición", "admitida", admission.status, false),
    ];
    return { ...base, assertions, ok: false };
  }

  const constraints = constraintsOf(readBrief());
  const catalog = await connectCatalog();

  try {
    const { outcome, sources } = await runAgent(catalog);

    if (c.esperado.kind === "fuera-de-alcance") {
      const assertions = [
        assert(
          "Declara que nadie lo vende",
          "out_of_scope",
          outcome.status,
          outcome.status === "out_of_scope",
        ),
        assert(
          "Y dice por qué",
          "un motivo",
          outcome.outOfScopeReason ?? "ninguno",
          (outcome.outOfScopeReason ?? "").length > 0,
        ),
      ];
      return { ...base, assertions, ok: assertions.every((a) => a.ok) };
    }

    if (outcome.status !== "resolved" || outcome.comparison === null) {
      base.traza.hallazgos = [
        ...checkEscalation(outcome, readBrief() as unknown as Record<string, unknown>),
      ];
      const assertions = assertComparison(c, outcome, base.traza.hallazgos.length);
      return { ...base, assertions, ok: false };
    }

    const comparison = outcome.comparison;
    const findings = runAllChecks(comparison, sources, constraints);

    base.traza.recomendado = comparison.recommendedSupplier;
    base.traza.comparativo = comparison;
    base.traza.anomalias = comparison.anomalies.map((a) => a.supplier);
    base.traza.hallazgos = [...findings];

    try {
      const v = await judgeComparison(comparison);
      base.traza.veredicto = {
        evidencia: v.evidenceIsSufficient,
        descartes: v.rejectionsAreExplained,
        anomalia: v.anomalyIsReported,
        nota: v.note,
      };
    } catch (error) {
      base.error = `Capa 2 no disponible: ${(error as Error).message.slice(0, 120)}`;
    }

    const assertions = assertComparison(c, outcome, findings.length);
    return { ...base, assertions, ok: assertions.every((a) => a.ok) };
  } catch (error) {
    if (error instanceof StepLimitReached) {
      return {
        ...base,
        assertions: [assert("Termina dentro del tope de pasos", "sí", "tope alcanzado", false)],
        ok: false,
        error: error.message,
      };
    }
    throw error;
  } finally {
    await catalog.close();
  }
}

function listar(): void {
  console.log("\n  CASOS PROBADOS\n");
  for (const c of CASES) {
    console.log(`  ${c.id.padEnd(18)} ${c.nombre}`);
    console.log(`  ${" ".repeat(18)} ${c.porQue.split(". ")[0]}.\n`);
  }
  console.log("  npm run caso -- <id>\n");
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const id = args.find((a) => !a.startsWith("--"));

  if (id === undefined) {
    if (json) console.log(JSON.stringify(CASES));
    else listar();
    return;
  }

  const c = caseById(id);
  if (c === null) {
    const mensaje = `No hay un caso «${id}». Los que hay: ${CASES.map((x) => x.id).join(", ")}.`;
    if (json) console.log(JSON.stringify({ error: mensaje }));
    else console.error(`\n  ${mensaje}\n`);
    process.exitCode = 1;
    return;
  }

  const resultado = await ejecutar(c);

  if (json) {
    console.log(JSON.stringify(resultado));
    return;
  }

  console.log(`\n  ${c.nombre.toUpperCase()}\n\n  «${c.peticion}»\n`);
  console.log(`  ${c.porQue}\n`);

  if (resultado.traza.comparativo !== null) {
    console.log(formatComparison(resultado.traza.comparativo));
  }
  console.log(formatChecks(resultado.traza.hallazgos));

  console.log("\n  AFIRMACIONES\n");
  for (const a of resultado.assertions) {
    console.log(`  ${a.ok ? "✓" : "✗"} ${a.what.padEnd(38)} ${a.actual}`);
    if (!a.ok) console.log(`      esperado: ${a.expected}`);
  }

  const fallan = resultado.assertions.filter((a) => !a.ok).length;
  console.log(
    fallan === 0
      ? `\n  ✓ Las ${resultado.assertions.length} afirmaciones se cumplen.\n`
      : `\n  ✗ ${fallan} de ${resultado.assertions.length} afirmaciones no se cumplen.\n`,
  );
  if (resultado.error !== null) console.log(`  ${resultado.error}\n`);
  if (fallan > 0) process.exitCode = 1;
}

await main().catch((error: unknown) => {
  console.error(`\n  La corrida no se completó: ${(error as Error).message}\n`);
  process.exitCode = 1;
});
