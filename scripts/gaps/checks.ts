/**
 * Verificación por código del comparativo.
 *
 * Seis comprobaciones sobre lo que tiene respuesta mecánica. No llaman a
 * ningún modelo, no cuestan nada y devuelven siempre lo mismo para la misma
 * entrada.
 *
 * Lo que exige criterio no va aquí: va en `judge.ts`.
 *
 * HUECO 3 · Complete las tres partes marcadas.
 *
 * `checkNormalization` y `checkMissingResponses` vienen resueltas y son la
 * referencia de la forma: conviene leerlas antes de empezar. Toda verificación
 * recorre el comparativo, se queda con lo que incumple y devuelve un hallazgo
 * por caso, con el dato que lo demuestra.
 *
 * `npm test -- checks` es la condición de parada.
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

  // <<< HUECO 3a >>>
  // Lo anterior cubre al que falta y al que sobra, y aun así deja pasar un
  // informe contradictorio. El caso salió de una corrida real: el modelo
  // declaró a un proveedor sin respuesta y además le inventó una cotización.
  // Como figuraba en alguna de las dos listas, la cobertura lo daba por
  // cubierto.
  //
  // Falta el hallazgo que reporta esa contradicción. Los conjuntos `quoted` y
  // `absent` ya están construidos arriba, y `checkNormalization`, más abajo,
  // muestra la forma que tiene una verificación completa.

  return findings;
}

/**
 * Toda cotización recibida tiene su precio llevado a base comparable.
 *
 * Viene resuelta: es la forma que tienen las demás. Una verificación recorre
 * el comparativo, se queda con lo que incumple y devuelve un hallazgo por
 * caso, con el dato que lo demuestra.
 */
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
  // <<< HUECO 3b >>>
  // Un hallazgo por cada cotización cuyo total declarado no cuadre con sus
  // componentes: precio unitario × QUANTITY + flete. El detalle debe mostrar
  // ambas cifras y la diferencia, para que se pueda comprobar a mano.
  //
  // Admita un margen de redondeo. Hay una prueba de precisión que decide si
  // el margen está bien planteado.
  return [];
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

  // Una cotización que excede una restricción y aun así se declara conforme.
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

  // <<< HUECO 3c >>>
  // Lo anterior confía en lo que la cotización declara sobre sí misma, y eso
  // es justo lo que una inyección manipula: basta con declararse conforme.
  //
  // Falta comprobar al proveedor recomendado contra las dos restricciones
  // duras, mirando sus cifras y no su declaración. Es la comprobación que
  // sostiene aunque el modelo haya sido convencido.

  return findings;
}

/**
 * Lo que no llegó está reportado. En este encargo siempre hay al menos uno.
 *
 * Viene resuelta. Es la más corta de las cinco y la que más se olvida: un
 * informe que no menciona lo que falta parece completo.
 */
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

export const ALL_CHECKS = [
  checkCoverage,
  checkNormalization,
  checkArithmetic,
  checkHardLimits,
  checkMissingResponses,
  checkTieBreak,
] as const;

/** Corre las seis y acumula. No se detiene en la primera. */
export function runAllChecks(comparison: Comparison): Finding[] {
  return ALL_CHECKS.flatMap((check) => check(comparison));
}
