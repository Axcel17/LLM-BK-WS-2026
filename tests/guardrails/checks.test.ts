/**
 * TODO 3 · Las seis verificaciones por código.
 *
 * Cada prueba construye un comparativo con un defecto concreto y exige que la
 * verificación lo detecte. Un comparativo correcto no produce hallazgos.
 *
 *     npm test -- checks
 */

import { describe, expect, it } from "vitest";

import {
  checkArithmetic,
  checkCoverage,
  checkHardLimits,
  checkMissingResponses,
  checkNormalization,
  runAllChecks,
  checkTieBreak,
} from "../../src/guardrails/checks.js";
import type { Comparison, Quote } from "../../src/domain/schemas.js";

function quote(
  supplier: string,
  unitPriceUsd: number,
  freightUsd: number,
  totalDeliveredUsd: number,
  leadTimeBusinessDays: number | null,
  overrides: Partial<Quote> = {},
): Quote {
  return {
    supplier,
    unitPriceUsd,
    freightUsd,
    totalDeliveredUsd,
    leadTimeBusinessDays,
    meetsLeadTime: true,
    meetsBudget: true,
    evidence: `Evidencia citada de la cotización de ${supplier}`,
    ...overrides,
  };
}

function correctComparison(overrides: Partial<Comparison> = {}): Comparison {
  return {
    quotes: [
      quote("MayoristaZeta", 159, 0, 6360, 8),
      quote("Suministros Delta", 164, 60, 6620, 9),
      quote("Tecnoimport", 168, 85, 6805, 6),
      quote("GlobalStock", 149, 0, 5960, 22, { meetsLeadTime: false }),
    ],
    noResponse: [{ supplier: "ImportAndina", status: "in_progress", detail: "Solicitud en cola." }],
    anomalies: [],
    recommendedSupplier: "MayoristaZeta",
    rationale: "Menor total puesto en bodega entre las que cumplen el plazo.",
    ...overrides,
  };
}

describe("runAllChecks", () => {
  it("no produce hallazgos sobre un comparativo correcto", () => {
    expect(runAllChecks(correctComparison())).toEqual([]);
  });
});

describe("checkCoverage", () => {
  it("detecta un proveedor ausente del informe", () => {
    const incomplete = correctComparison({
      quotes: correctComparison().quotes.filter((q) => q.supplier !== "Tecnoimport"),
    });
    expect(checkCoverage(incomplete).some((f) => f.detail.includes("Tecnoimport"))).toBe(true);
  });

  it("detecta un proveedor que no estaba en el encargo", () => {
    const invented = correctComparison({
      quotes: [...correctComparison().quotes, quote("ProveedorFantasma", 100, 0, 4000, 5)],
    });
    expect(checkCoverage(invented).length).toBeGreaterThan(0);
  });

  it("detecta un proveedor que figura como cotización y como ausencia", () => {
    // Observado en una corrida real: el modelo declaró a ImportAndina sin
    // respuesta y además le inventó una cotización. De las dos entradas hay
    // una falsa, y sin esta comprobación el informe parecía completo.
    const contradictory = correctComparison({
      quotes: [...correctComparison().quotes, quote("ImportAndina", 250, 0, 10000, null)],
    });

    expect(checkCoverage(contradictory).some((f) => f.detail.includes("a la vez"))).toBe(true);
  });
});

describe("checkTieBreak", () => {
  it("detecta una recomendación que cumple pero no es la más barata", () => {
    const suboptimo = correctComparison({ recommendedSupplier: "Tecnoimport" });

    const findings = checkTieBreak(suboptimo);

    expect(findings).toHaveLength(1);
    expect(findings[0]?.detail).toContain("Tecnoimport");
    expect(findings[0]?.detail).toContain("MayoristaZeta");
  });

  it("la recomendación correcta no produce hallazgo", () => {
    expect(checkTieBreak(correctComparison())).toEqual([]);
  });

  it("no duplica el hallazgo cuando el recomendado ni siquiera cumple", () => {
    // De eso se encarga `checkHardLimits`: aquí no se vuelve a reportar.
    const incumple = correctComparison({ recommendedSupplier: "GlobalStock" });
    expect(checkTieBreak(incumple)).toEqual([]);
  });

  it("sin recomendación no hay desempate que comprobar", () => {
    expect(checkTieBreak(correctComparison({ recommendedSupplier: null }))).toEqual([]);
  });
});

describe("checkNormalization", () => {
  it("detecta un precio unitario no positivo", () => {
    const broken = correctComparison({
      quotes: [quote("MayoristaZeta", 0, 0, 6360, 8), ...correctComparison().quotes.slice(1)],
    });
    expect(checkNormalization(broken).length).toBeGreaterThan(0);
  });
});

describe("checkArithmetic", () => {
  it("detecta un total que no cuadra con sus componentes", () => {
    const broken = correctComparison({
      quotes: [quote("MayoristaZeta", 159, 0, 6900, 8), ...correctComparison().quotes.slice(1)],
    });
    expect(checkArithmetic(broken).some((f) => f.detail.includes("MayoristaZeta"))).toBe(true);
  });

  it("tolera una diferencia de un centavo por redondeo", () => {
    const rounded = correctComparison({
      quotes: [quote("MayoristaZeta", 159, 0, 6360.01, 8), ...correctComparison().quotes.slice(1)],
    });
    expect(checkArithmetic(rounded)).toEqual([]);
  });
});

describe("checkHardLimits", () => {
  it("detecta que se recomienda a quien incumple el plazo", () => {
    const manipulated = correctComparison({ recommendedSupplier: "GlobalStock" });
    expect(checkHardLimits(manipulated).some((f) => f.detail.includes("GlobalStock"))).toBe(true);
  });

  it("detecta conformidad declarada sobre un plazo excedido", () => {
    const broken = correctComparison({
      quotes: [
        ...correctComparison().quotes.slice(0, 3),
        quote("GlobalStock", 149, 0, 5960, 22, { meetsLeadTime: true }),
      ],
    });
    expect(checkHardLimits(broken).length).toBeGreaterThan(0);
  });

  it("detecta conformidad declarada sobre un presupuesto excedido", () => {
    const expensive = correctComparison({
      quotes: [
        quote("Tecnoimport", 200, 100, 8100, 6, { meetsBudget: true }),
        ...correctComparison().quotes.slice(0, 3),
      ],
    });
    expect(checkHardLimits(expensive).some((f) => f.detail.includes("tope"))).toBe(true);
  });
});

describe("checkMissingResponses", () => {
  it("detecta un informe que omite a quien no respondió", () => {
    expect(checkMissingResponses(correctComparison({ noResponse: [] })).length).toBeGreaterThan(0);
  });
});
