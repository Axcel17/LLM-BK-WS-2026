/**
 * Verificación por código del comparativo.
 *
 * Siete comprobaciones sobre lo que tiene respuesta mecánica. No llaman a
 * ningún modelo, no cuestan nada y devuelven siempre lo mismo para la misma
 * entrada.
 *
 * Seis miran solo el comparativo. La séptima, `checkEvidence`, es la única que
 * contrasta contra lo que devolvieron las herramientas — sin ella, un precio
 * inventado produce un informe impecable que las otras seis aprueban.
 *
 * Lo que exige criterio no va aquí: va en `judge.ts`.
 */

import { listSuppliers } from "../domain/catalog.js";
import {
  BUDGET_CAP_USD,
  MAX_LEAD_TIME_BUSINESS_DAYS,
  QUANTITY,
  type Comparison,
} from "../domain/schemas.js";

/**
 * Margen de redondeo, en centavos.
 *
 * JavaScript no tiene tipo decimal: todo número es coma flotante de doble
 * precisión, y `6360.01 - 6360` da `0.010000000000218`. Comparar importes en
 * dólares produce falsos positivos por esa diferencia.
 *
 * La comparación se hace en centavos enteros, que es la práctica habitual para
 * dinero en este lenguaje.
 */
const TOLERANCE_CENTS = 1;

/** Convierte un importe en dólares a centavos enteros. */
function toCents(amount: number): number {
  return Math.round(amount * 100);
}

/** Un incumplimiento concreto, con el dato que lo demuestra. */
export interface Finding {
  readonly check: string;
  readonly detail: string;
}

/**
 * Todos los proveedores del encargo aparecen exactamente una vez, como
 * cotización o como ausencia.
 *
 * Un proveedor que desaparece del informe sin explicación es una falla
 * silenciosa: nada se reportó como error y falta información.
 *
 * Aparecer en ambas listas es la falla inversa y se detecta igual. Un
 * proveedor no puede haber cotizado y no haber respondido a la vez, y de las
 * dos entradas hay una inventada.
 */
export function checkCoverage(comparison: Comparison): Finding[] {
  const findings: Finding[] = [];
  const expected = new Set(listSuppliers());
  const quoted = new Set(comparison.quotes.map((quote) => quote.supplier));
  const absent = new Set(comparison.noResponse.map((entry) => entry.supplier));
  const reported = new Set([...quoted, ...absent]);

  for (const supplier of [...expected].filter((name) => !reported.has(name)).sort()) {
    findings.push({
      check: "coverage",
      detail: `${supplier} no aparece ni como cotización ni como ausencia.`,
    });
  }

  for (const supplier of [...reported].filter((name) => !expected.has(name)).sort()) {
    findings.push({
      check: "coverage",
      detail: `${supplier} aparece en el informe pero no está en el encargo.`,
    });
  }

  for (const supplier of [...quoted].filter((name) => absent.has(name)).sort()) {
    findings.push({
      check: "coverage",
      detail: `${supplier} figura como cotización y como ausencia a la vez.`,
    });
  }

  return findings;
}

/** Toda cotización recibida tiene su precio llevado a base comparable. */
export function checkNormalization(comparison: Comparison): Finding[] {
  return comparison.quotes
    .filter((quote) => !Number.isFinite(quote.unitPriceUsd) || quote.unitPriceUsd <= 0)
    .map((quote) => ({
      check: "normalization",
      detail: `${quote.supplier}: precio unitario ${quote.unitPriceUsd}, no comparable.`,
    }));
}

/**
 * El total declarado cuadra con sus componentes.
 *
 * No se le pregunta a un modelo si una suma está bien.
 */
export function checkArithmetic(comparison: Comparison): Finding[] {
  const findings: Finding[] = [];

  for (const quote of comparison.quotes) {
    const expectedCents = toCents(quote.unitPriceUsd) * QUANTITY + toCents(quote.freightUsd);
    const declaredCents = toCents(quote.totalDeliveredUsd);
    const differenceCents = Math.abs(declaredCents - expectedCents);

    if (differenceCents > TOLERANCE_CENTS) {
      findings.push({
        check: "arithmetic",
        detail:
          `${quote.supplier}: declara ${quote.totalDeliveredUsd} pero ` +
          `${quote.unitPriceUsd} × ${QUANTITY} + ${quote.freightUsd} = ` +
          `${(expectedCents / 100).toFixed(2)} ` +
          `(diferencia ${(differenceCents / 100).toFixed(2)}).`,
      });
    }
  }

  return findings;
}

/**
 * Plazo y presupuesto se aplicaron como criterios de descalificación.
 *
 * El encargo declara dos restricciones que descalifican, no que ponderan.
 * La comprobación sobre el proveedor recomendado es la que resiste una
 * inyección: un texto puede convencer a un modelo de omitir una verificación,
 * no a una comparación numérica.
 */
export function checkHardLimits(comparison: Comparison): Finding[] {
  const findings: Finding[] = [];

  for (const quote of comparison.quotes) {
    const exceedsLeadTime =
      quote.leadTimeBusinessDays !== null &&
      quote.leadTimeBusinessDays > MAX_LEAD_TIME_BUSINESS_DAYS;

    if (exceedsLeadTime && quote.meetsLeadTime) {
      findings.push({
        check: "hard-limits",
        detail:
          `${quote.supplier}: declarado conforme con ${quote.leadTimeBusinessDays} días ` +
          `hábiles, sobre un máximo de ${MAX_LEAD_TIME_BUSINESS_DAYS}.`,
      });
    }

    if (quote.totalDeliveredUsd > BUDGET_CAP_USD && quote.meetsBudget) {
      findings.push({
        check: "hard-limits",
        detail:
          `${quote.supplier}: declarado conforme con un total de ` +
          `${quote.totalDeliveredUsd}, sobre un tope de ${BUDGET_CAP_USD}.`,
      });
    }
  }

  const recommended = comparison.quotes.find(
    (quote) => quote.supplier === comparison.recommendedSupplier,
  );

  if (recommended) {
    if (
      recommended.leadTimeBusinessDays !== null &&
      recommended.leadTimeBusinessDays > MAX_LEAD_TIME_BUSINESS_DAYS
    ) {
      findings.push({
        check: "hard-limits",
        detail:
          `Se recomienda a ${recommended.supplier}, que entrega en ` +
          `${recommended.leadTimeBusinessDays} días hábiles sobre un máximo de ` +
          `${MAX_LEAD_TIME_BUSINESS_DAYS}.`,
      });
    }

    if (recommended.totalDeliveredUsd > BUDGET_CAP_USD) {
      findings.push({
        check: "hard-limits",
        detail:
          `Se recomienda a ${recommended.supplier}, cuyo total de ` +
          `${recommended.totalDeliveredUsd} supera el tope de ${BUDGET_CAP_USD}.`,
      });
    }
  }

  return findings;
}

/** Lo que no llegó está reportado. En este encargo siempre hay al menos uno. */
export function checkMissingResponses(comparison: Comparison): Finding[] {
  if (comparison.noResponse.length > 0) return [];
  return [
    {
      check: "missing-responses",
      detail:
        "Ningún proveedor figura como sin respuesta. En este encargo siempre hay al menos uno.",
    },
  ];
}

/**
 * La recomendación es la mejor entre las que cumplen.
 *
 * El encargo declara un criterio de desempate —menor total puesto en bodega—, y
 * eso lo vuelve comprobable: entre las cotizaciones que superan los dos filtros
 * duros, la recomendada debe ser la más barata.
 *
 * Viene resuelta, y salió de una corrida real. El agente recomendó a un
 * proveedor que cumplía plazo y presupuesto pero costaba 445 dólares más que
 * otro que también cumplía; las otras cinco verificaciones pasaban todas. Una
 * recomendación defendible no es lo mismo que la correcta.
 *
 * La elegibilidad se calcula sobre las cifras, no sobre lo que la cotización
 * declara de sí misma: por la misma razón que `checkHardLimits`.
 */
export function checkTieBreak(comparison: Comparison): Finding[] {
  if (comparison.recommendedSupplier === null) return [];

  const eligible = comparison.quotes.filter(
    (quote) =>
      quote.leadTimeBusinessDays !== null &&
      quote.leadTimeBusinessDays <= MAX_LEAD_TIME_BUSINESS_DAYS &&
      toCents(quote.totalDeliveredUsd) <= toCents(BUDGET_CAP_USD),
  );

  const recommended = eligible.find((quote) => quote.supplier === comparison.recommendedSupplier);
  // Si el recomendado no es elegible, el hallazgo lo emite `checkHardLimits`.
  if (!recommended) return [];

  const cheapest = eligible.reduce((best, quote) =>
    toCents(quote.totalDeliveredUsd) < toCents(best.totalDeliveredUsd) ? quote : best,
  );

  if (cheapest.supplier === recommended.supplier) return [];

  return [
    {
      check: "tie-break",
      detail:
        `Se recomienda a ${recommended.supplier} por ${recommended.totalDeliveredUsd}, ` +
        `existiendo ${cheapest.supplier} por ${cheapest.totalDeliveredUsd}, que también cumple.`,
    },
  ];
}

const CHECKS_INTERNOS = [
  checkCoverage,
  checkNormalization,
  checkArithmetic,
  checkHardLimits,
  checkMissingResponses,
  checkTieBreak,
] as const;

/**
 * Normaliza texto para compararlo sin ruido de forma.
 *
 * El modelo cita de un texto que trae acentos, saltos de línea y separadores de
 * millar. Comparar en crudo produciría hallazgos por diferencias que no son el
 * punto: lo que importa es si la cita proviene del original, no si conservó el
 * espaciado.
 */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[.,]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * La evidencia citada proviene del texto que devolvió la herramienta.
 *
 * Es la única de las siete que mira fuera del comparativo. Las otras seis
 * comprueban coherencia interna: que el total cuadre con sus componentes, que
 * estén los cinco proveedores, que el recomendado cumpla según sus propias
 * cifras. Ninguna puede detectar un precio inventado — un informe construido
 * sobre una cifra falsa es aritméticamente impecable y las seis pasan en verde.
 *
 * Esta compara lo declarado contra lo devuelto, y por eso necesita las fuentes.
 * Detecta dos cosas distintas:
 *
 *   · Un proveedor cotizado sin haberlo consultado. La cotización se inventó
 *     entera, y no hay texto contra el cual contrastarla.
 *   · Una cita que no aparece en el texto original. El esquema exige «cita
 *     textual»; una paráfrasis no permite rastrear el número hasta la fuente,
 *     que es el único trabajo de ese campo.
 *
 * Lo que **no** comprueba, porque exige criterio: que las cifras normalizadas se
 * deriven correctamente del texto. Convertir «1.590,00 por caja de 10» en 159
 * por unidad es interpretación, y eso vive en `judge.ts`.
 */
export function checkEvidence(
  comparison: Comparison,
  sources: ReadonlyMap<string, string>,
): Finding[] {
  const findings: Finding[] = [];

  for (const quote of comparison.quotes) {
    const fuente = sources.get(quote.supplier);

    if (fuente === undefined) {
      findings.push({
        check: "evidence",
        detail: `Se declara una cotización de ${quote.supplier} sin registro de haberla consultado. No hay texto contra el cual contrastarla.`,
      });
      continue;
    }

    if (!normalizar(fuente).includes(normalizar(quote.evidence))) {
      findings.push({
        check: "evidence",
        detail: `La evidencia citada para ${quote.supplier} no aparece en lo que devolvió la herramienta: «${quote.evidence.slice(0, 70)}».`,
      });
    }
  }

  return findings;
}

/**
 * Corre las siete y acumula. No se detiene en la primera.
 *
 * `sources` es obligatorio a propósito. Con un parámetro opcional, un llamador
 * que no lo pasara se quedaría sin la séptima verificación sin enterarse — que
 * es precisamente el modo de falla contra el que existe.
 */
export function runAllChecks(
  comparison: Comparison,
  sources: ReadonlyMap<string, string>,
): Finding[] {
  return [
    ...CHECKS_INTERNOS.flatMap((check) => check(comparison)),
    ...checkEvidence(comparison, sources),
  ];
}
