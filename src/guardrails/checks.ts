/**
 * Verificación por código del comparativo.
 *
 * Cinco comprobaciones sobre lo que tiene respuesta mecánica. No llaman a
 * ningún modelo, no cuestan nada y devuelven siempre lo mismo para la misma
 * entrada.
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

export const ALL_CHECKS = [
  checkCoverage,
  checkNormalization,
  checkArithmetic,
  checkHardLimits,
  checkMissingResponses,
] as const;

/** Corre las cinco y acumula. No se detiene en la primera. */
export function runAllChecks(comparison: Comparison): Finding[] {
  return ALL_CHECKS.flatMap((check) => check(comparison));
}
