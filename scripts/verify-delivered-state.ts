/**
 * Verifica el estado con el que se entrega el material.
 *
 * El README y la guía anuncian un número exacto de pruebas que pasan y que
 * fallan, y el asistente lo usa para saber si su instalación está bien. Ese
 * número se desfasa en cuanto alguien agrega una prueba o cambia un `TODO`, y
 * quien lo descubre es el asistente, en la sala, sin forma de distinguir un
 * material desactualizado de una instalación rota.
 *
 * Este script lo impone: corre la suite sobre `main` tal como se entrega y
 * compara el resultado contra lo prometido, incluyendo el texto de los dos
 * documentos. Es la misma tesis del taller aplicada al propio taller — una
 * cifra declarada y no comprobada es un umbral interpretado.
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Lo que el material promete. Cambiar aquí obliga a cambiarlo en los documentos. */
const PROMETIDO = { pasan: 175, fallan: 11, pendientes: 1 } as const;

/** Documentos que repiten la cifra y deben coincidir. */
const DOCUMENTOS = ["README.md", "GUIA.md"] as const;

type Resumen = {
  numPassedTests: number;
  numFailedTests: number;
  numTodoTests: number;
  testResults: Array<{
    name: string;
    assertionResults: Array<{ status: string }>;
  }>;
};

function correrSuite(): Resumen {
  const folder = mkdtempSync(join(tmpdir(), "estado-"));
  const outputFile = join(folder, "estado.json");
  try {
    // vitest termina con código distinto de cero porque los `TODO` sin
    // completar hacen fallar sus pruebas: aquí eso es lo esperado, no un error.
    try {
      execFileSync("npx", ["vitest", "run", "--reporter=json", `--outputFile=${outputFile}`], {
        stdio: "ignore",
      });
    } catch {
      /* se evalúa por el informe, no por el código de salida */
    }
    return JSON.parse(readFileSync(outputFile, "utf8")) as Resumen;
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}

function porArchivo(resumen: Resumen): Map<string, { pasan: number; fallan: number }> {
  const raiz = join(process.cwd(), "tests", "/");
  return new Map(
    resumen.testResults.map((archivo) => [
      archivo.name.replace(raiz, ""),
      {
        pasan: archivo.assertionResults.filter((a) => a.status === "passed").length,
        fallan: archivo.assertionResults.filter((a) => a.status === "failed").length,
      },
    ]),
  );
}

/**
 * Emite el desglose por archivo, en las dos ramas, como filas de tabla.
 *
 * El material del instructor lleva esa tabla para poder decir en voz alta qué
 * debe ver cada participante. Medirla a mano la desfasa cada vez que alguien
 * agrega una prueba, así que se regenera: `npm run verify-state -- --table`.
 */
function emitirTabla(): void {
  const swap = (rama: "gaps" | "solutions") =>
    execFileSync("npx", ["tsx", "scripts/swap.ts", rama], { stdio: "ignore" });

  try {
    swap("gaps");
    const entrega = porArchivo(correrSuite());
    swap("solutions");
    const resuelto = porArchivo(correrSuite());

    const orden = [...entrega.keys()].sort((a, b) => {
      const pendiente = (k: string) => ((entrega.get(k)?.fallan ?? 0) > 0 ? 1 : 0);
      return pendiente(a) - pendiente(b) || a.localeCompare(b);
    });

    for (const archivo of orden) {
      const { pasan, fallan } = entrega.get(archivo) ?? { pasan: 0, fallan: 0 };
      const conTodo =
        fallan === 0
          ? `**${pasan} pasan**`
          : `${pasan} pasan, ${fallan} falla${fallan > 1 ? "n" : ""}`;
      console.log(`| \`${archivo}\` | ${conTodo} | ${resuelto.get(archivo)?.pasan ?? 0} |`);
    }
  } finally {
    swap("gaps");
  }
}

if (process.argv.includes("--table")) {
  emitirTabla();
  process.exit(0);
}

const problems: string[] = [];

const summary = correrSuite();
const actual = {
  pasan: summary.numPassedTests,
  fallan: summary.numFailedTests,
  pendientes: summary.numTodoTests,
};

for (const key of ["pasan", "fallan", "pendientes"] as const) {
  if (actual[key] !== PROMETIDO[key]) {
    problems.push(
      `La suite reporta ${actual[key]} pruebas que ${key}; el material promete ${PROMETIDO[key]}.`,
    );
  }
}

const figure = `${PROMETIDO.pasan} pruebas pasan y ${PROMETIDO.fallan} fallan`;
for (const document of DOCUMENTOS) {
  if (!readFileSync(document, "utf8").includes(figure)) {
    problems.push(`${document} no declara «${figure}».`);
  }
}

if (problems.length > 0) {
  console.error("\nEl estado de entrega no coincide con lo prometido:\n");
  for (const problem of problems) console.error(`  · ${problem}`);
  console.error(
    "\nActualice PROMETIDO en scripts/verify-delivered-state.ts y la cifra en " +
      `${DOCUMENTOS.join(" y ")}.\n`,
  );
  process.exit(1);
}

console.log(
  `Estado de entrega verificado: ${actual.pasan} pasan, ${actual.fallan} fallan, ` +
    `${actual.pendientes} pendiente(s), y los documentos lo declaran.`,
);
