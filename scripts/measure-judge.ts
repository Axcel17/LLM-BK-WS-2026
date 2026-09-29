/**
 * Mide el evaluador por modelo contra casos con veredicto conocido.
 *
 *     npm run measure-judge          una pasada por caso
 *     npm run measure-judge -- 3     tres pasadas por caso
 *
 * Por qué existe: `measure-reliability.ts` mide al agente y deja al evaluador
 * fuera del número, porque medir un juez no determinista sobre la salida de un
 * agente no determinista da una cifra que no se puede atribuir. Este script
 * rompe esa dependencia dándole al evaluador comparativos fijos, de modo que
 * la única variación sea la suya.
 *
 * El fallo que importa es **un evaluador que nunca dice que no**. Los tres
 * casos con un `false` esperado son los que lo detectan; el caso correcto es
 * el contrapeso que impide aprobar a uno que responde `false` a todo.
 */

import { judgeComparison, type Verdict } from "../src/guardrails/judge.js";
import { CASES, type LabeledCase } from "./judge-cases.js";

const CRITERIA = ["evidenceIsSufficient", "rejectionsAreExplained", "anomalyIsReported"] as const;

const LABEL = {
  evidenceIsSufficient: "evidencia",
  rejectionsAreExplained: "descartes",
  anomalyIsReported: "anomalía",
} as const;

function passes(value = process.argv[2]): number {
  if (value === undefined) return 1;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(`El número de pasadas debe ser un entero positivo. Recibido: ${value}`);
  }
  return n;
}

type CaseResult = { agreements: number; total: number; disagreements: string[] };

async function evaluate(testCase: LabeledCase, times: number, index: number): Promise<CaseResult> {
  const result: CaseResult = { agreements: 0, total: 0, disagreements: [] };

  for (let i = 0; i < times; i += 1) {
    emit({
      tipo: "caso-empieza",
      index,
      pass: i + 1,
      name: testCase.name,
      isolates: testCase.isolates,
      expected: testCase.expected,
      comparison: testCase.comparison,
    });

    let verdict: Verdict;
    try {
      verdict = await judgeComparison(testCase.comparison);
    } catch (error) {
      result.total += CRITERIA.length;
      const detail = (error as Error).message.slice(0, 70);
      result.disagreements.push(`no respondió: ${detail}`);
      emit({
        tipo: "caso-termina",
        index,
        pass: i + 1,
        agreements: 0,
        verdict: null,
        error: detail,
      });
      continue;
    }

    let agreed = 0;

    for (const criterio of CRITERIA) {
      result.total += 1;
      if (verdict[criterio] === testCase.expected[criterio]) {
        result.agreements += 1;
        agreed += 1;
      } else {
        result.disagreements.push(
          `${LABEL[criterio]}: esperado ${testCase.expected[criterio]}, dijo ${verdict[criterio]}` +
            ` · «${verdict.note.slice(0, 90)}»`,
        );
      }
    }

    emit({
      tipo: "caso-termina",
      index,
      pass: i + 1,
      agreements: agreed,
      verdict: { ...verdict },
      error: null,
    });
  }

  return result;
}

/** `--json` emite el resultado en una línea, al terminar. */
const jsonOnly = process.argv.includes("--json");

/**
 * `--stream` emite una línea JSON por evento, a medida que ocurren.
 *
 * Una evaluación que solo habla al final pide la misma confianza ciega que este
 * material enseña a no dar: con cinco pasadas son veinte llamadas a un modelo y
 * varios minutos sin saber en qué caso va ni qué se le está preguntando.
 */
const streaming = process.argv.includes("--stream");

function emit(event: Record<string, unknown>): void {
  if (streaming) console.log(JSON.stringify(event));
}

async function main(): Promise<void> {
  const times = passes(process.argv.filter((a) => !a.startsWith("--"))[2]);

  emit({
    tipo: "inicio",
    casos: CASES.length,
    passes: times,
    total: CASES.length * times * CRITERIA.length,
  });

  if (!jsonOnly && !streaming) {
    console.log(
      `\n  ${CASES.length} casos × ${times} pasada(s) · ${CASES.length * times} llamadas\n`,
    );
  }

  let agreements = 0;
  let total = 0;
  const pending: string[] = [];
  const forJson: Array<Record<string, unknown>> = [];

  for (const testCase of CASES) {
    const r = await evaluate(testCase, times, CASES.indexOf(testCase));
    agreements += r.agreements;
    total += r.total;
    forJson.push({
      name: testCase.name,
      isolates: testCase.isolates,
      expected: testCase.expected,
      agreements: r.agreements,
      total: r.total,
      disagreements: r.disagreements,
    });
    if (jsonOnly || streaming) continue;

    const mark = r.disagreements.length === 0 ? "✓" : "✗";
    const isolates = testCase.isolates === "ninguno" ? "contrapeso" : LABEL[testCase.isolates];
    console.log(
      `  ${mark} ${testCase.name.padEnd(34)} ${String(r.agreements).padStart(2)}/${r.total}  (${isolates})`,
    );
    for (const d of r.disagreements) pending.push(`      ${testCase.name} → ${d}`);
  }

  if (streaming) {
    emit({ tipo: "fin", agreements, total, resultados: forJson });
    return;
  }

  if (jsonOnly) {
    console.log(JSON.stringify({ passes: times, resultados: forJson, agreements, total }));
    return;
  }

  if (pending.length > 0) {
    console.log("\n  Desacuerdos:\n");
    for (const p of pending) console.log(p);
  }

  const pct = total === 0 ? 0 : Math.round((agreements / total) * 100);
  console.log(`\n  acuerdo: ${agreements}/${total} (${pct} %)`);
  console.log(
    "\n  Esto mide acuerdo con las etiquetas de `judge-cases.ts`, no verdad." +
      "\n  Si un desacuerdo parece razonable, la etiqueta es lo que hay que discutir.\n",
  );

  // Un desacuerdo no es un fallo del script: es el dato. El código de salida
  // distingue «corrió» de «no pudo correr», no «acertó» de «no acertó».
}

main().catch((error: unknown) => {
  console.error(`\n  ${(error as Error).message}\n`);
  process.exitCode = 1;
});
