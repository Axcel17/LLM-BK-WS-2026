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
import { CASOS, type CasoEtiquetado } from "./judge-cases.js";

const CRITERIOS = ["evidenceIsSufficient", "rejectionsAreExplained", "anomalyIsReported"] as const;

const ETIQUETA = {
  evidenceIsSufficient: "evidencia",
  rejectionsAreExplained: "descartes",
  anomalyIsReported: "anomalía",
} as const;

function pasadas(valor = process.argv[2]): number {
  if (valor === undefined) return 1;
  const n = Number(valor);
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(`El número de pasadas debe ser un entero positivo. Recibido: ${valor}`);
  }
  return n;
}

type Resultado = { acuerdos: number; total: number; desacuerdos: string[] };

async function evaluar(caso: CasoEtiquetado, veces: number, indice: number): Promise<Resultado> {
  const resultado: Resultado = { acuerdos: 0, total: 0, desacuerdos: [] };

  for (let i = 0; i < veces; i += 1) {
    evento({
      tipo: "caso-empieza",
      indice,
      pasada: i + 1,
      nombre: caso.nombre,
      aisla: caso.aisla,
      esperado: caso.esperado,
      comparativo: caso.comparison,
    });

    let veredicto: Verdict;
    try {
      veredicto = await judgeComparison(caso.comparison);
    } catch (error) {
      resultado.total += CRITERIOS.length;
      const detalle = (error as Error).message.slice(0, 70);
      resultado.desacuerdos.push(`no respondió: ${detalle}`);
      evento({
        tipo: "caso-termina",
        indice,
        pasada: i + 1,
        acuerdos: 0,
        veredicto: null,
        error: detalle,
      });
      continue;
    }

    let deAcuerdo = 0;

    for (const criterio of CRITERIOS) {
      resultado.total += 1;
      if (veredicto[criterio] === caso.esperado[criterio]) {
        resultado.acuerdos += 1;
        deAcuerdo += 1;
      } else {
        resultado.desacuerdos.push(
          `${ETIQUETA[criterio]}: esperado ${caso.esperado[criterio]}, dijo ${veredicto[criterio]}` +
            ` · «${veredicto.note.slice(0, 90)}»`,
        );
      }
    }

    evento({
      tipo: "caso-termina",
      indice,
      pasada: i + 1,
      acuerdos: deAcuerdo,
      veredicto: { ...veredicto },
      error: null,
    });
  }

  return resultado;
}

/** `--json` emite el resultado en una línea, al terminar. */
const soloJson = process.argv.includes("--json");

/**
 * `--stream` emite una línea JSON por evento, a medida que ocurren.
 *
 * Una evaluación que solo habla al final pide la misma confianza ciega que este
 * material enseña a no dar: con cinco pasadas son veinte llamadas a un modelo y
 * varios minutos sin saber en qué caso va ni qué se le está preguntando.
 */
const transmitir = process.argv.includes("--stream");

function evento(dato: Record<string, unknown>): void {
  if (transmitir) console.log(JSON.stringify(dato));
}

async function main(): Promise<void> {
  const veces = pasadas(process.argv.filter((a) => !a.startsWith("--"))[2]);

  evento({
    tipo: "inicio",
    casos: CASOS.length,
    pasadas: veces,
    total: CASOS.length * veces * CRITERIOS.length,
  });

  if (!soloJson && !transmitir) {
    console.log(
      `\n  ${CASOS.length} casos × ${veces} pasada(s) · ${CASOS.length * veces} llamadas\n`,
    );
  }

  let acuerdos = 0;
  let total = 0;
  const pendientes: string[] = [];
  const paraJson: Array<Record<string, unknown>> = [];

  for (const caso of CASOS) {
    const r = await evaluar(caso, veces, CASOS.indexOf(caso));
    acuerdos += r.acuerdos;
    total += r.total;
    paraJson.push({
      nombre: caso.nombre,
      aisla: caso.aisla,
      esperado: caso.esperado,
      acuerdos: r.acuerdos,
      total: r.total,
      desacuerdos: r.desacuerdos,
    });
    if (soloJson || transmitir) continue;

    const marca = r.desacuerdos.length === 0 ? "✓" : "✗";
    const aisla = caso.aisla === "ninguno" ? "contrapeso" : ETIQUETA[caso.aisla];
    console.log(
      `  ${marca} ${caso.nombre.padEnd(34)} ${String(r.acuerdos).padStart(2)}/${r.total}  (${aisla})`,
    );
    for (const d of r.desacuerdos) pendientes.push(`      ${caso.nombre} → ${d}`);
  }

  if (transmitir) {
    evento({ tipo: "fin", acuerdos, total, resultados: paraJson });
    return;
  }

  if (soloJson) {
    console.log(JSON.stringify({ pasadas: veces, resultados: paraJson, acuerdos, total }));
    return;
  }

  if (pendientes.length > 0) {
    console.log("\n  Desacuerdos:\n");
    for (const p of pendientes) console.log(p);
  }

  const pct = total === 0 ? 0 : Math.round((acuerdos / total) * 100);
  console.log(`\n  acuerdo: ${acuerdos}/${total} (${pct} %)`);
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
