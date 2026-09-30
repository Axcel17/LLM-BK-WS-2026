/**
 * Admisión de una petición en prosa.
 *
 * Lo que se fija aquí es la forma, no el criterio del modelo: que una
 * requisición declarada completa traiga los cuatro datos que hacen falta, que
 * una incompleta enumere qué falta, y que los valores por omisión sean los del
 * caso y no invenciones.
 *
 *     npm test -- intake
 */

import { describe, expect, it } from "vitest";

import {
  briefFrom,
  extractionSchema,
  type IntakeOutcome,
  settle,
} from "../../src/domain/intake.js";

function admitted(overrides: Partial<IntakeOutcome> = {}): IntakeOutcome {
  return {
    status: "complete",
    product: "Teclado inalámbrico",
    quantity: 100,
    maxLeadTimeBusinessDays: 5,
    budgetCapUsd: 3000,
    warranty: null,
    citations: [],
    missing: [],
    question: null,
    notes: null,
    ...overrides,
  } as IntakeOutcome;
}

describe("briefFrom", () => {
  it("traslada los cuatro datos de la petición", () => {
    const brief = briefFrom(admitted(), ["Tecnoimport"]);

    expect(brief.product).toBe("Teclado inalámbrico");
    expect(brief.quantity).toBe(100);
    expect(brief.maxLeadTimeBusinessDays).toBe(5);
    expect(brief.budgetCapUsd).toBe(3000);
  });

  it("la garantía no declarada toma el valor por omisión, no uno inventado", () => {
    expect(briefFrom(admitted(), []).warranty).toContain("estandar del proveedor");
  });

  it("conserva la garantía cuando la petición sí la declara", () => {
    const brief = briefFrom(admitted({ warranty: "Extendida a 24 meses" }), []);
    expect(brief.warranty).toBe("Extendida a 24 meses");
  });

  it("los proveedores vienen del catálogo, no de la petición", () => {
    // Quien pide no elige a quién se consulta: eso lo decide el sistema.
    const brief = briefFrom(admitted(), ["Tecnoimport", "MayoristaZeta"]);
    expect(brief.suppliers).toEqual(["Tecnoimport", "MayoristaZeta"]);
  });

  it("el criterio de desempate no depende de la petición", () => {
    // Si quien pide pudiera cambiarlo, `checkTieBreak` no tendría contra qué
    // comprobar: sería un umbral interpretado otra vez.
    expect(briefFrom(admitted(), []).selectionCriterion).toContain("menor total puesto en bodega");
  });
});

describe("settle", () => {
  it("con los cuatro datos, la requisición está completa", () => {
    expect(settle(admitted()).status).toBe("complete");
  });

  it("un dato ausente la vuelve incompleta, aunque el modelo no lo note", () => {
    // El modo de falla real: el modelo devolvió los tres datos que leyó y
    // rotuló el resultado como completo. El estado se calcula, no se pregunta.
    const result = settle(admitted({ budgetCapUsd: null, missing: [], question: null }));

    expect(result.status).toBe("missing_information");
    expect(result.missing.map((m) => m.field)).toEqual(["budgetCapUsd"]);
    expect(result.question).toContain("budgetCapUsd");
  });

  it("conserva la explicación del modelo cuando la dio", () => {
    const result = settle(
      admitted({
        maxLeadTimeBusinessDays: null,
        missing: [{ field: "maxLeadTimeBusinessDays", why: "La peticion no da unidad de tiempo." }],
      }),
    );

    expect(result.missing[0]?.why).toBe("La peticion no da unidad de tiempo.");
  });

  it("descarta lo que el modelo enumeró como faltante si el dato sí está", () => {
    const result = settle(
      admitted({ missing: [{ field: "warranty", why: "No se menciona la garantia." }] }),
    );

    expect(result.status).toBe("complete");
    expect(result.missing).toEqual([]);
  });

  it("enumera los cuatro cuando la petición no dice nada", () => {
    const result = settle(
      admitted({
        product: null,
        quantity: null,
        maxLeadTimeBusinessDays: null,
        budgetCapUsd: null,
      }),
    );

    expect(result.missing).toHaveLength(4);
  });
});

describe("briefFrom sobre una requisición incompleta", () => {
  it("falla en lugar de entregar una requisición con huecos", () => {
    // Sin esto, `budgetCapUsd` llegaría como null a la comparación y el tope
    // dejaría de descalificar a nadie, en silencio.
    expect(() => briefFrom(admitted({ budgetCapUsd: null }), [])).toThrow("budgetCapUsd");
  });
});

describe("el esquema de extracción", () => {
  function extraction(citations: Array<{ field: string; quotation: string }>) {
    return {
      product: 'Monitor 24" Full HD',
      quantity: 40,
      maxLeadTimeBusinessDays: 10,
      budgetCapUsd: 7000,
      warranty: null,
      citations,
      missing: [],
      question: null,
      notes: null,
    };
  }

  it("admite una cita de dos caracteres", () => {
    // Medido con gemini-3.1-flash-lite: cita la cifra desnuda «40» donde
    // gpt-5.4-mini cita «40 monitores». Un piso de longitud aquí rechazaba una
    // cita correcta y con ella el objeto entero.
    const parsed = extractionSchema.safeParse(extraction([{ field: "quantity", quotation: "40" }]));

    expect(parsed.success).toBe(true);
  });

  it("no admite una cita vacía, que no señala nada", () => {
    const parsed = extractionSchema.safeParse(extraction([{ field: "quantity", quotation: "" }]));

    expect(parsed.success).toBe(false);
  });
});
