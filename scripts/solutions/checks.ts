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
import type { Comparison, Constraints, Outcome } from "../domain/schemas.js";

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
export function checkArithmetic(comparison: Comparison, c: Constraints): Finding[] {
  const findings: Finding[] = [];

  for (const quote of comparison.quotes) {
    const expectedCents = toCents(quote.unitPriceUsd) * c.quantity + toCents(quote.freightUsd);
    const declaredCents = toCents(quote.totalDeliveredUsd);
    const differenceCents = Math.abs(declaredCents - expectedCents);

    if (differenceCents > TOLERANCE_CENTS) {
      findings.push({
        check: "arithmetic",
        detail:
          `${quote.supplier}: declara ${quote.totalDeliveredUsd} pero ` +
          `${quote.unitPriceUsd} × ${c.quantity} + ${quote.freightUsd} = ` +
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
export function checkHardLimits(comparison: Comparison, c: Constraints): Finding[] {
  const findings: Finding[] = [];

  for (const quote of comparison.quotes) {
    const exceedsLeadTime =
      quote.leadTimeBusinessDays !== null && quote.leadTimeBusinessDays > c.maxLeadTimeBusinessDays;

    if (exceedsLeadTime && quote.meetsLeadTime) {
      findings.push({
        check: "hard-limits",
        detail:
          `${quote.supplier}: declarado conforme con ${quote.leadTimeBusinessDays} días ` +
          `hábiles, sobre un máximo de ${c.maxLeadTimeBusinessDays}.`,
      });
    }

    if (quote.totalDeliveredUsd > c.budgetCapUsd && quote.meetsBudget) {
      findings.push({
        check: "hard-limits",
        detail:
          `${quote.supplier}: declarado conforme con un total de ` +
          `${quote.totalDeliveredUsd}, sobre un tope de ${c.budgetCapUsd}.`,
      });
    }
  }

  const recommended = comparison.quotes.find(
    (quote) => quote.supplier === comparison.recommendedSupplier,
  );

  if (recommended) {
    if (
      recommended.leadTimeBusinessDays !== null &&
      recommended.leadTimeBusinessDays > c.maxLeadTimeBusinessDays
    ) {
      findings.push({
        check: "hard-limits",
        detail:
          `Se recomienda a ${recommended.supplier}, que entrega en ` +
          `${recommended.leadTimeBusinessDays} días hábiles sobre un máximo de ` +
          `${c.maxLeadTimeBusinessDays}.`,
      });
    }

    if (recommended.totalDeliveredUsd > c.budgetCapUsd) {
      findings.push({
        check: "hard-limits",
        detail:
          `Se recomienda a ${recommended.supplier}, cuyo total de ` +
          `${recommended.totalDeliveredUsd} supera el tope de ${c.budgetCapUsd}.`,
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
export function checkTieBreak(comparison: Comparison, c: Constraints): Finding[] {
  if (comparison.recommendedSupplier === null) return [];

  const eligible = comparison.quotes.filter(
    (quote) =>
      quote.leadTimeBusinessDays !== null &&
      quote.leadTimeBusinessDays <= c.maxLeadTimeBusinessDays &&
      toCents(quote.totalDeliveredUsd) <= toCents(c.budgetCapUsd),
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

/** Las que solo miran el comparativo. */
const SIN_REQUISICION = [checkCoverage, checkNormalization, checkMissingResponses] as const;

/** Las que comprueban contra las restricciones de la requisición. */
const CON_REQUISICION = [checkArithmetic, checkHardLimits, checkTieBreak] as const;

/**
 * Reduce un texto a su contenido, descartando toda la forma.
 *
 * Acentos, mayúsculas, puntuación, alineación en columnas, barras invertidas y
 * secuencias de escape desaparecen: quedan solo letras y dígitos separados por
 * un espacio. Lo que se compara es lo que el texto dice, no cómo se escribió.
 *
 * Es deliberadamente agresivo. Cada forma de citar que el modelo inventa
 * —entrecomillar fragmentos, unirlos con barras, escapar los saltos de línea al
 * copiar una tabla— produciría un hallazgo sobre evidencia legítima, y una
 * verificación que salta sobre salida correcta enseña a ignorar las
 * verificaciones. Sigue detectando lo que importa: un texto que no está.
 */
function normalizar(texto: string): string {
  return (
    texto
      .replace(/\\[nrt]/g, " ")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      // Los separadores entre dígitos son formato, no contenido: unen la cifra en
      // vez de partirla. Sin esto, «1.590,00» daría «1 590 00» y «1590,00» daría
      // «1590 00», que es la misma cifra escrita de dos maneras.
      .replace(/(\d)[.,\u202f\u00a0'](?=\d)/g, "$1")
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
  );
}

/**
 * Longitud mínima para que un fragmento sea evidencia y no coincidencia.
 *
 * Un trozo de seis caracteres aparece en cualquier texto por casualidad, y una
 * verificación que se satisface con eso no verifica nada.
 */
const FRAGMENTO_MINIMO = 14;

/**
 * Parte la cita en los tramos que hay que encontrar en la fuente.
 *
 * El modelo no siempre cita un tramo continuo: lo habitual es entrecomillar dos
 * o tres trozos de líneas distintas y unirlos. Se separa antes de normalizar,
 * porque los caracteres que marcan el corte son justo los que la normalización
 * descarta.
 */
function fragmentos(cita: string): string[] {
  const partes = cita
    .split(/["'`“”‘’]|\s*[/|]\s*|\.{3,}|…|\n|\\n/)
    .map(normalizar)
    .filter((parte) => parte.length >= FRAGMENTO_MINIMO);

  return partes.length > 0 ? partes : [normalizar(cita)];
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

    const enLaFuente = normalizar(fuente);
    const ausentes = fragmentos(quote.evidence).filter((f) => !enLaFuente.includes(f));

    if (ausentes.length > 0) {
      findings.push({
        check: "evidence",
        detail: `La evidencia citada para ${quote.supplier} no aparece en lo que devolvió la herramienta: «${ausentes[0]?.slice(0, 70)}».`,
      });
    }
  }

  return findings;
}

/**
 * Una escalación pide lo que de verdad falta.
 *
 * La coherencia de la forma ya la impone el esquema: un resultado que dice
 * «falta información» sin enumerar qué falta no llega hasta aquí, porque no
 * valida. Lo que sí queda por comprobar es el contenido — que el agente no
 * escale por un dato que ya tenía.
 *
 * Es el modo de falla que reemplaza al de inventar. Antes, sin una salida para
 * la carencia, el agente rellenaba; con una salida disponible, el riesgo se
 * invierte y pasa a ser pedir de más para no equivocarse. Eso detiene el
 * trabajo con una pregunta cuya respuesta estaba en la requisición.
 *
 * `checkEvidence` compara lo declarado contra lo devuelto por las herramientas;
 * esta compara lo pedido contra lo que ya se había entregado.
 */
export function checkEscalation(
  outcome: Outcome,
  requisition: Readonly<Record<string, unknown>>,
): Finding[] {
  if (outcome.status !== "missing_information") return [];

  return outcome.missing
    .filter(({ field }) => {
      const valor = requisition[field];
      if (valor === undefined || valor === null) return false;
      if (typeof valor === "string") return valor.trim() !== "";
      if (Array.isArray(valor)) return valor.length > 0;
      return true;
    })
    .map(({ field }) => ({
      check: "escalation",
      detail: `Se pide «${field}» para poder continuar, y la requisición ya lo declara: ${JSON.stringify(requisition[field])}.`,
    }));
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
  constraints: Constraints,
): Finding[] {
  return [
    ...SIN_REQUISICION.flatMap((check) => check(comparison)),
    ...CON_REQUISICION.flatMap((check) => check(comparison, constraints)),
    ...checkEvidence(comparison, sources),
  ];
}
