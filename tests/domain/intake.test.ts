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

import { briefFrom, type IntakeOutcome } from "../../src/domain/intake.js";

function admitted(overrides: Partial<IntakeOutcome> = {}): IntakeOutcome {
  return {
    status: "complete",
    product: "Teclado inalámbrico",
    quantity: 100,
    maxLeadTimeBusinessDays: 5,
    budgetCapUsd: 3000,
    warranty: null,
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
