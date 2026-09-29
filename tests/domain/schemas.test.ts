/**
 * TODO 1 · El contrato de datos.
 *
 * Fallan hasta que los tres campos estén declarados en src/domain/schemas.ts:
 * el plazo del `TODO(1a)`, y las dos listas del `TODO(1b)`.
 *
 *     npm test -- schemas
 */

import { describe, expect, it } from "vitest";

import {
  anomalySchema,
  makeComparisonSchema,
  makeOutcomeSchema,
  type Constraints,
} from "../../src/domain/schemas.js";

/** Las restricciones del caso, que en producción salen de la requisición. */
const DEL_CASO: Constraints = { quantity: 40, maxLeadTimeBusinessDays: 10, budgetCapUsd: 7_000 };

const quoteSchema = makeComparisonSchema(DEL_CASO).shape.quotes.element;
const comparisonSchema = makeComparisonSchema(DEL_CASO);
const outcomeSchema = makeOutcomeSchema(DEL_CASO);

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
      validQuote({ unitPriceUsd: 1590, totalDeliveredUsd: 7_000 * 10 }),
    );
    expect(result.success).toBe(false);
  });

  it("acepta el total correcto del caso", () => {
    expect(quoteSchema.parse(validQuote()).totalDeliveredUsd).toBe(159 * 40);
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

  // La regla «una cotización no puede declararse conforme con un plazo que
  // descalifica» vivía aquí y en `checkHardLimits`: dos copias de la misma
  // comprobación, una de las cuales fijaba el plazo del caso dentro del
  // esquema. Quedó solo en la verificación, que recibe el plazo de la
  // requisición — ver «detecta conformidad declarada sobre un plazo excedido».

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

describe("outcomeSchema", () => {
  const base = {
    status: "resolved" as const,
    comparison: validComparison(),
    missing: [],
    question: null,
    outOfScopeReason: null,
  };

  it("un resultado resuelto exige comparativo", () => {
    // Sin esta regla, «resuelto» sin comparativo sería una salida válida que no
    // resuelve nada, y las siete verificaciones no tendrían qué comprobar.
    expect(outcomeSchema.safeParse({ ...base, comparison: null }).success).toBe(false);
  });

  it("declarar que falta información exige enumerar qué falta y preguntarlo", () => {
    const vago = {
      ...base,
      status: "missing_information" as const,
      comparison: null,
      missing: [],
      question: "¿Me das más datos?",
    };

    expect(outcomeSchema.safeParse(vago).success).toBe(false);
  });

  it("acepta una escalación bien formada", () => {
    const escala = outcomeSchema.parse({
      ...base,
      status: "missing_information",
      comparison: null,
      missing: [{ field: "budgetCapUsd", why: "Sin tope no se puede descartar por presupuesto." }],
      question: "¿Cuál es el presupuesto máximo puesto en bodega?",
    });

    expect(escala.missing[0]?.field).toBe("budgetCapUsd");
  });

  it("el campo que falta es un enumerado, no texto libre", () => {
    // Con texto libre, «presupuesto» y «budgetCapUsd» son cadenas distintas que
    // ninguna verificación puede contrastar contra la requisición.
    const inventado = {
      ...base,
      status: "missing_information" as const,
      comparison: null,
      missing: [{ field: "color_preferido", why: "Hace falta saber el color que quieren." }],
      question: "¿De qué color los quieren?",
    };

    expect(outcomeSchema.safeParse(inventado).success).toBe(false);
  });

  it("declarar algo fuera de alcance exige decir por qué", () => {
    const sinMotivo = { ...base, status: "out_of_scope" as const, comparison: null };
    expect(outcomeSchema.safeParse(sinMotivo).success).toBe(false);
  });
});
