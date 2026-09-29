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
const PROMETIDO = { pasan: 107, fallan: 11, pendientes: 1 } as const;

/** Documentos que repiten la cifra y deben coincidir. */
const DOCUMENTOS = ["README.md", "GUIA.md"] as const;

type Resumen = {
  numPassedTests: number;
  numFailedTests: number;
  numTodoTests: number;
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
