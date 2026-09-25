/**
 * La compuerta de aprobación.
 *
 * Comprueban lo que distingue un umbral impuesto de uno interpretado: estas
 * pruebas no llaman a ningún modelo, porque la decisión no depende de él.
 *
 *     npm test -- approval
 */

import { describe, expect, it } from "vitest";

import { createApprovalGate, IRREVERSIBLE_TOOLS } from "../../src/guardrails/approval.js";

describe("createApprovalGate", () => {
  it("deja pasar las consultas de solo lectura", () => {
    const gate = createApprovalGate();

    expect(gate.decide({ toolCall: { toolName: "get_brief", input: {} } })).toBe("not-applicable");
    expect(
      gate.decide({ toolCall: { toolName: "get_quote", input: { supplier: "MayoristaZeta" } } }),
    ).toBe("not-applicable");
    expect(gate.denied).toHaveLength(0);
  });

  it("deniega la emisión de una orden y explica por qué", () => {
    const gate = createApprovalGate();

    const decision = gate.decide({
      toolCall: { toolName: "place_order", input: { supplier: "MayoristaZeta", totalUsd: 6360 } },
    });

    expect(decision).toMatchObject({ type: "denied" });
    expect((decision as { reason: string }).reason).toMatch(/recomienda, no adjudica/i);
  });

  it("registra lo denegado, con los argumentos que se intentaron", () => {
    const gate = createApprovalGate();

    gate.decide({
      toolCall: { toolName: "place_order", input: { supplier: "GlobalStock", totalUsd: 5915 } },
    });

    expect(gate.denied).toHaveLength(1);
    expect(gate.denied[0]).toMatchObject({
      tool: "place_order",
      input: { supplier: "GlobalStock", totalUsd: 5915 },
    });
  });

  it("deniega también cuando los argumentos parecen razonables", () => {
    // El criterio es la irreversibilidad de la acción, no lo defendible del
    // importe. Un total dentro de presupuesto no convierte en aprobable algo
    // que este agente no decide.
    const gate = createApprovalGate();

    const decision = gate.decide({
      toolCall: { toolName: "place_order", input: { supplier: "MayoristaZeta", totalUsd: 1 } },
    });

    expect(decision).toMatchObject({ type: "denied" });
  });

  it("la tabla de acciones irreversibles es el único criterio", () => {
    expect(IRREVERSIBLE_TOOLS).toContain("place_order");
    expect(IRREVERSIBLE_TOOLS).not.toContain("get_quote");
  });
});
