/**
 * Acceso a los datos del caso.
 *
 *     npm test -- catalog
 */

import { describe, expect, it } from "vitest";

import { readBrief, readQuote } from "../../src/domain/catalog.js";

describe("catalog", () => {
  it("el encargo trae las restricciones y el criterio de desempate", () => {
    const brief = readBrief();
    expect(brief.quantity).toBe(40);
    expect(brief.maxLeadTimeBusinessDays).toBe(10);
    expect(brief.selectionCriterion).toBeTruthy();
  });

  it("la cotización llega sin limpiar", () => {
    // El texto de GlobalStock conserva la nota dirigida a sistemas
    // automatizados: filtrarla en la fuente escondería el problema.
    expect(readQuote("GlobalStock")).toContain("sistemas de procesamiento automatizado");
  });

  it("un proveedor inexistente falla con un mensaje útil", () => {
    expect(() => readQuote("ProveedorQueNoExiste")).toThrow(/Disponibles/);
  });
});
