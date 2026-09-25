/**
 * HUECO 1 · El contrato de datos.
 *
 * Fallan hasta que los tres campos estén declarados en src/schemas.ts. Cuando
 * pasan, el contrato está bien definido.
 *
 *     npm test -- schemas
 */

import { describe, expect, it } from "vitest";

import {
  BUDGET_CAP_USD,
  QUANTITY,
  anomalySchema,
  comparisonSchema,
  quoteSchema,
} from "../../src/domain/schemas.js";

function validQuote(overrides: Record<string, unknown> = {}) {
  return {
    supplier: "MayoristaZeta",
    unitPriceUsd: 159,
    freightUsd: 0,
    totalDeliveredUsd: 6360,
    leadTimeBusinessDays: 8,
    meetsLeadTime: true,
    meetsBudget: true,
    evidence: "PRECIO POR CAJA USD 1.590,00 — caja cerrada de 10 unidades",
    ...overrides,
  };
}

function validComparison(overrides: Record<string, unknown> = {}) {
  return {
    quotes: [validQuote()],
    noResponse: [{ supplier: "ImportAndina", status: "in_progress", detail: "Solicitud en cola." }],
    anomalies: [],
    recommendedSupplier: "MayoristaZeta",
    rationale: "Menor total puesto en bodega entre las que cumplen el plazo.",
    ...overrides,
  };
}

describe("quoteSchema · precio unitario", () => {
  it("acepta un precio positivo", () => {
    expect(quoteSchema.parse(validQuote()).unitPriceUsd).toBe(159);
  });

  it("rechaza cero y negativos", () => {
    for (const invalid of [0, -5]) {
      expect(quoteSchema.safeParse(validQuote({ unitPriceUsd: invalid })).success).toBe(false);
    }
  });
});

describe("quoteSchema · plazo", () => {
  it("acepta la ausencia de plazo declarado", () => {
    const quote = quoteSchema.parse(
      validQuote({ leadTimeBusinessDays: null, meetsLeadTime: false }),
    );
    expect(quote.leadTimeBusinessDays).toBeNull();
  });

  it("es obligatorio: omitirlo invalida la cotización", () => {
    const { leadTimeBusinessDays: _omitted, ...withoutLeadTime } = validQuote();
    expect(quoteSchema.safeParse(withoutLeadTime).success).toBe(false);
  });

  it("rechaza valores negativos", () => {
    expect(quoteSchema.safeParse(validQuote({ leadTimeBusinessDays: -3 })).success).toBe(false);
  });
});

describe("quoteSchema · plausibilidad del total", () => {
  it("rechaza un total que implica menos de un dólar por unidad", () => {
    expect(quoteSchema.safeParse(validQuote({ totalDeliveredUsd: 1 })).success).toBe(false);
  });

  it("rechaza un total de otro orden de magnitud", () => {
    const result = quoteSchema.safeParse(
      validQuote({ unitPriceUsd: 1590, totalDeliveredUsd: BUDGET_CAP_USD * 10 }),
    );
    expect(result.success).toBe(false);
  });

  it("acepta el total correcto del caso", () => {
    expect(quoteSchema.parse(validQuote()).totalDeliveredUsd).toBe(159 * QUANTITY);
  });
});

describe("comparisonSchema", () => {
  it("exige declarar lo que no llegó", () => {
    const { noResponse: _omitted, ...withoutNoResponse } = validComparison();
    expect(comparisonSchema.safeParse(withoutNoResponse).success).toBe(false);
  });

  it("exige declarar las anomalías, aunque sea una lista vacía", () => {
    const { anomalies: _omitted, ...withoutAnomalies } = validComparison();
    expect(comparisonSchema.safeParse(withoutAnomalies).success).toBe(false);
  });

  it("rechaza declarar conforme un plazo que descalifica", () => {
    const result = comparisonSchema.safeParse(
      validComparison({
        quotes: [validQuote({ leadTimeBusinessDays: 22, meetsLeadTime: true })],
      }),
    );
    expect(result.success).toBe(false);
  });

  it("acepta un comparativo completo", () => {
    const comparison = comparisonSchema.parse(validComparison());
    expect(comparison.noResponse[0]?.supplier).toBe("ImportAndina");
  });
});

describe("anomalySchema", () => {
  it("exige el texto detectado", () => {
    const result = anomalySchema.safeParse({
      supplier: "GlobalStock",
      detectedText: "",
      whatItAskedFor: "Omitir la verificación de plazos",
      actionTaken: "No se siguió",
    });
    expect(result.success).toBe(false);
  });
});
