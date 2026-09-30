/**
 * TODO 3 · Las siete verificaciones por código.
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
  checkEscalation,
  checkExtraction,
  checkEvidence,
  checkHardLimits,
  checkMissingResponses,
  checkNormalization,
  checkTieBreak,
  runAllChecks,
} from "../../src/guardrails/checks.js";
import type { Comparison, Constraints, Quote } from "../../src/domain/schemas.js";

/** Las restricciones del caso, que en producción salen de la requisición. */
const CASE_CONSTRAINTS: Constraints = {
  quantity: 40,
  maxLeadTimeBusinessDays: 10,
  budgetCapUsd: 7_000,
};

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

/** Lo que habría devuelto `get_quote` para el comparativo correcto. */
function validSources(): Map<string, string> {
  return new Map(
    correctComparison().quotes.map((q) => [q.supplier, `Cotización.\n${q.evidence}\nFin.`]),
  );
}

describe("runAllChecks", () => {
  it("no produce hallazgos sobre un comparativo correcto", () => {
    expect(runAllChecks(correctComparison(), validSources(), CASE_CONSTRAINTS)).toEqual([]);
  });
});

describe("checkEvidence", () => {
  it("detecta un proveedor cotizado sin haberlo consultado", () => {
    // La cotización se inventó entera: no hay texto contra el cual contrastarla,
    // y las otras seis la aprobarían porque es internamente coherente.
    const sources = validSources();
    sources.delete("Tecnoimport");

    const findings = checkEvidence(correctComparison(), sources);

    expect(findings).toHaveLength(1);
    expect(findings[0]?.detail).toContain("Tecnoimport");
    expect(findings[0]?.detail).toContain("sin registro");
  });

  it("detecta una cita que no aparece en el texto devuelto", () => {
    const fabricated = correctComparison({
      quotes: [
        quote("MayoristaZeta", 159, 0, 6360, 8, {
          evidence: "Precio especial pactado por teléfono",
        }),
        ...correctComparison().quotes.slice(1),
      ],
    });

    const findings = checkEvidence(fabricated, validSources());

    expect(findings).toHaveLength(1);
    expect(findings[0]?.detail).toContain("no aparece");
  });

  it("tolera diferencias de acento, mayúsculas y separadores", () => {
    // El modelo cita de un texto con tildes y puntos de millar. Un hallazgo por
    // eso sería ruido: lo que importa es si la cita viene del original.
    const comparison = correctComparison({
      quotes: [
        quote("MayoristaZeta", 159, 0, 6360, 8, { evidence: "PRECIO POR CAJA USD 1590,00" }),
        ...correctComparison().quotes.slice(1),
      ],
    });
    const sources = validSources();
    sources.set("MayoristaZeta", "Precio por caja  USD 1.590,00 — caja cerrada");

    expect(checkEvidence(comparison, sources)).toEqual([]);
  });

  it("sin cotizaciones declaradas no hay nada que contrastar", () => {
    expect(checkEvidence(correctComparison({ quotes: [] }), new Map())).toEqual([]);
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

    const findings = checkTieBreak(suboptimo, CASE_CONSTRAINTS);

    expect(findings).toHaveLength(1);
    expect(findings[0]?.detail).toContain("Tecnoimport");
    expect(findings[0]?.detail).toContain("MayoristaZeta");
  });

  it("la recomendación correcta no produce hallazgo", () => {
    expect(checkTieBreak(correctComparison(), CASE_CONSTRAINTS)).toEqual([]);
  });

  it("no duplica el hallazgo cuando el recomendado ni siquiera cumple", () => {
    // De eso se encarga `checkHardLimits`: aquí no se vuelve a reportar.
    const incumple = correctComparison({ recommendedSupplier: "GlobalStock" });
    expect(checkTieBreak(incumple, CASE_CONSTRAINTS)).toEqual([]);
  });

  it("sin recomendación no hay desempate que comprobar", () => {
    expect(
      checkTieBreak(correctComparison({ recommendedSupplier: null }), CASE_CONSTRAINTS),
    ).toEqual([]);
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
    expect(
      checkArithmetic(broken, CASE_CONSTRAINTS).some((f) => f.detail.includes("MayoristaZeta")),
    ).toBe(true);
  });

  it("tolera una diferencia de un centavo por redondeo", () => {
    const rounded = correctComparison({
      quotes: [quote("MayoristaZeta", 159, 0, 6360.01, 8), ...correctComparison().quotes.slice(1)],
    });
    expect(checkArithmetic(rounded, CASE_CONSTRAINTS)).toEqual([]);
  });
});

describe("checkHardLimits", () => {
  it("detecta que se recomienda a quien incumple el plazo", () => {
    const manipulated = correctComparison({ recommendedSupplier: "GlobalStock" });
    expect(
      checkHardLimits(manipulated, CASE_CONSTRAINTS).some((f) => f.detail.includes("GlobalStock")),
    ).toBe(true);
  });

  it("detecta conformidad declarada sobre un plazo excedido", () => {
    const broken = correctComparison({
      quotes: [
        ...correctComparison().quotes.slice(0, 3),
        quote("GlobalStock", 149, 0, 5960, 22, { meetsLeadTime: true }),
      ],
    });
    expect(checkHardLimits(broken, CASE_CONSTRAINTS).length).toBeGreaterThan(0);
  });

  it("detecta conformidad declarada sobre un presupuesto excedido", () => {
    const expensive = correctComparison({
      quotes: [
        ...correctComparison().quotes.filter((q) => q.supplier !== "Tecnoimport"),
        quote("Tecnoimport", 200, 100, 8100, 6, { meetsBudget: true }),
      ],
    });
    expect(
      checkHardLimits(expensive, CASE_CONSTRAINTS).some((f) => f.detail.includes("tope")),
    ).toBe(true);
  });
});

describe("checkMissingResponses", () => {
  it("detecta un informe que omite a quien no respondió", () => {
    expect(checkMissingResponses(correctComparison({ noResponse: [] })).length).toBeGreaterThan(0);
  });
});

describe("checkEscalation", () => {
  const requisition = { product: "Monitor", quantity: 40, budgetCapUsd: 7000, warranty: "" };

  const escalation = (fields: Array<Parameters<typeof checkEscalation>[0]["missing"][number]>) =>
    ({
      status: "missing_information",
      comparison: null,
      missing: fields,
      question: "¿Cuál es el dato que falta?",
      outOfScopeReason: null,
    }) as Parameters<typeof checkEscalation>[0];

  it("detecta que se pide un dato que la requisición ya declara", () => {
    // El modo de falla que reemplaza al de inventar: con una salida disponible
    // para la carencia, el riesgo pasa a ser pedir de más para no equivocarse.
    const findings = checkEscalation(
      escalation([{ field: "quantity", why: "Sin cantidad no se puede cotizar nada." }]),
      requisition,
    );

    expect(findings).toHaveLength(1);
    expect(findings[0]?.detail).toContain("quantity");
    expect(findings[0]?.detail).toContain("40");
  });

  it("pedir un dato genuinamente ausente no produce hallazgo", () => {
    const findings = checkEscalation(
      escalation([
        { field: "maxLeadTimeBusinessDays", why: "Sin plazo no hay filtro de descalificación." },
      ]),
      requisition,
    );

    expect(findings).toEqual([]);
  });

  it("una cadena vacía cuenta como ausente", () => {
    const findings = checkEscalation(
      escalation([{ field: "warranty", why: "Sin definirla, el proveedor no puede cotizar." }]),
      requisition,
    );

    expect(findings).toEqual([]);
  });

  it("un resultado resuelto no tiene escalación que comprobar", () => {
    const resolved = {
      status: "resolved",
      comparison: correctComparison(),
      missing: [],
      question: null,
      outOfScopeReason: null,
    } as Parameters<typeof checkEscalation>[0];

    expect(checkEscalation(resolved, requisition)).toEqual([]);
  });
});

describe("checkEvidence · formas reales de citar", () => {
  it("acepta una cita partida en fragmentos entrecomillados", () => {
    // Observado con gpt-5.4-mini: el modelo entrecomilla dos trozos de líneas
    // distintas y los une con una barra. Exigir la cadena continua producía un
    // hallazgo sobre evidencia legítima, y una verificación que salta sobre
    // salida correcta enseña a ignorarla.
    const comparison = correctComparison({
      quotes: [
        quote("MayoristaZeta", 159, 0, 6360, 8, {
          evidence: '"PRECIO POR CAJA ...... USD 1.590,00" / "Flete: INCLUIDO en el precio"',
        }),
        ...correctComparison().quotes.slice(1),
      ],
    });
    const sources = validSources();
    sources.set(
      "MayoristaZeta",
      "PRECIO POR CAJA .............. USD 1.590,00\nFlete: INCLUIDO en el precio\nPlazo: 8 dias",
    );

    expect(checkEvidence(comparison, sources)).toEqual([]);
  });

  it("sigue detectando un fragmento que no está en la fuente", () => {
    const comparison = correctComparison({
      quotes: [
        quote("MayoristaZeta", 159, 0, 6360, 8, {
          evidence: '"PRECIO POR CAJA USD 1.590,00" / "descuento por volumen aplicado"',
        }),
        ...correctComparison().quotes.slice(1),
      ],
    });
    const sources = validSources();
    sources.set("MayoristaZeta", "PRECIO POR CAJA USD 1.590,00\nFlete incluido");

    const findings = checkEvidence(comparison, sources);

    expect(findings).toHaveLength(1);
    expect(findings[0]?.detail).toContain("descuento por volumen");
  });
});

describe("checkExtraction", () => {
  const request = "Necesitamos 100 monitores de 24 pulgadas, máximo 5 días hábiles";

  it("detecta un dato que no aparece en la petición", () => {
    // El modo de falla de la admisión: un presupuesto leído y uno supuesto
    // tienen la misma forma, y sin la cita son indistinguibles.
    const findings = checkExtraction(
      { citations: [{ field: "budgetCapUsd", quotation: "presupuesto de 20000 dólares" }] },
      request,
    );

    expect(findings).toHaveLength(1);
    expect(findings[0]?.detail).toContain("budgetCapUsd");
    expect(findings[0]?.detail).toContain("no aparece");
  });

  it("acepta una cita que sí está, con otra forma", () => {
    const findings = checkExtraction(
      { citations: [{ field: "quantity", quotation: "100 MONITORES de 24 pulgadas" }] },
      request,
    );

    expect(findings).toEqual([]);
  });

  it("sin citas no hay nada que rastrear", () => {
    expect(checkExtraction({ citations: [] }, request)).toEqual([]);
  });

  it("reporta una por cada cita que no se sostiene", () => {
    const findings = checkExtraction(
      {
        citations: [
          { field: "quantity", quotation: "100 monitores de 24 pulgadas" },
          { field: "budgetCapUsd", quotation: "con un techo de quince mil" },
          { field: "warranty", quotation: "garantia extendida a 24 meses" },
        ],
      },
      request,
    );

    expect(findings).toHaveLength(2);
  });
});

describe("checkExtraction sobre un dato sin cita", () => {
  it("reporta un campo extraído que no dice de dónde salió", () => {
    // Sin la cita no hay nada que rastrear, y el campo pasaría sin verificar.
    const findings = checkExtraction(
      { citations: [{ field: "product", quotation: "monitores" }], budgetCapUsd: 20000 },
      "Necesitamos monitores",
    );

    expect(findings).toHaveLength(1);
    expect(findings[0]?.detail).toContain("sin citar");
  });
});
