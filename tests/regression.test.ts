/**
 * Fallos reales, convertidos en pruebas.
 *
 * Un sistema no determinista no se estabiliza razonando sobre él: se
 * estabiliza acumulando los casos en que falló. Cada fallo observado en una
 * corrida entra aquí, y a partir de ese momento ninguna versión futura puede
 * reintroducirlo sin que las pruebas lo digan.
 *
 * Este archivo es el que crece con el uso. Los tres primeros casos salieron de
 * corridas reales durante la preparación del taller.
 *
 *     npm test -- regression
 */

import { describe, expect, it } from "vitest";

import { checkArithmetic, checkCoverage, runAllChecks } from "../src/guardrails/checks.js";
import { comparisonSchema, type Comparison, type Quote } from "../src/domain/schemas.js";

function quote(overrides: Partial<Quote> & { supplier: string }): Quote {
  return {
    unitPriceUsd: 159,
    freightUsd: 0,
    totalDeliveredUsd: 6360,
    leadTimeBusinessDays: 8,
    meetsLeadTime: true,
    meetsBudget: true,
    evidence: "Cita textual de la cotización recibida",
    ...overrides,
  };
}

/** Comparativo correcto del caso, con los cinco proveedores del encargo. */
function comparison(overrides: Partial<Comparison> = {}): Comparison {
  return {
    quotes: [
      quote({ supplier: "MayoristaZeta", unitPriceUsd: 159, totalDeliveredUsd: 6360 }),
      quote({
        supplier: "Suministros Delta",
        unitPriceUsd: 164,
        freightUsd: 60,
        totalDeliveredUsd: 6620,
        leadTimeBusinessDays: 9,
      }),
      quote({
        supplier: "Tecnoimport",
        unitPriceUsd: 168,
        freightUsd: 85,
        totalDeliveredUsd: 6805,
        leadTimeBusinessDays: 6,
      }),
      quote({
        supplier: "GlobalStock",
        unitPriceUsd: 149,
        totalDeliveredUsd: 5960,
        leadTimeBusinessDays: 22,
        meetsLeadTime: false,
      }),
    ],
    noResponse: [{ supplier: "ImportAndina", status: "in_progress", detail: "En cola." }],
    anomalies: [],
    recommendedSupplier: "MayoristaZeta",
    rationale: "Menor total puesto en bodega entre las que cumplen el plazo.",
    ...overrides,
  };
}

describe("fallos observados en corridas reales", () => {
  it("el precio por caja tomado como total", () => {
    // Observado con gemini-3.1-flash-lite. La cotización de MayoristaZeta dice
    // 1.590,00 por caja de diez unidades. El modelo copió esa cifra como total
    // puesto en bodega, cuando el total de 40 unidades son 6.360.
    const findings = checkArithmetic(
      comparison({
        quotes: [quote({ supplier: "MayoristaZeta", unitPriceUsd: 159, totalDeliveredUsd: 1590 })],
      }),
    );

    expect(findings).toHaveLength(1);
    expect(findings[0]?.detail).toContain("6360.00");
  });

  it("un proveedor desaparecido del informe", () => {
    // Observado durante la preparación: el informe traía cuatro proveedores de
    // los cinco del encargo, sin declarar al quinto como ausencia. Nada se
    // reportó como error. Es la falla silenciosa del segmento 7.
    const findings = checkCoverage(
      comparison({ quotes: [quote({ supplier: "MayoristaZeta" })], noResponse: [] }),
    );

    expect(findings.length).toBeGreaterThan(0);
    expect(findings.map((finding) => finding.detail).join(" ")).toContain("ImportAndina");
  });

  it("el plazo omitido cuando el campo admitía valor por defecto", () => {
    // Observado con el esquema anterior, donde `leadTimeBusinessDays` tenía
    // `.default(null)`: el modelo omitía el campo y la verificación de plazo
    // se quedaba sin nada que comprobar. El esquema actual lo exige.
    const withoutLeadTime = {
      ...comparison(),
      quotes: [{ ...quote({ supplier: "MayoristaZeta" }), leadTimeBusinessDays: undefined }],
    };

    expect(comparisonSchema.safeParse(withoutLeadTime).success).toBe(false);
  });

  it("un comparativo correcto no produce hallazgos", () => {
    // El contrapeso: sin esta prueba, una verificación que siempre reporta
    // algo pasaría las tres anteriores.
    expect(runAllChecks(comparison())).toEqual([]);
  });

  // Pendiente de completar. Ejecutar `npm run agent` hasta observar un
  // resultado que no debería haberse aceptado, y declarar aquí la prueba que
  // lo detecta. El sistema mejora por acumulación de fallos observados, no por
  // ajustar las instrucciones hasta que una corrida resulte correcta.
  it.todo("el fallo observado en una corrida propia");
});
