/**
 * Pruebas del evaluador por modelo.
 *
 * Corren sin red ni clave: usan un modelo simulado que devuelve un veredicto
 * fijo. Verifican el contrato del evaluador y su aislamiento, no el criterio
 * del modelo, que por naturaleza no es determinista.
 *
 *     npm test -- judge
 */

import type { LanguageModelV4GenerateResult } from "@ai-sdk/provider";
import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";

import { judgeComparison, verdictSchema } from "../../src/guardrails/judge.js";
import type { Comparison } from "../../src/domain/schemas.js";

const VERDICT = {
  citedEvidence: "PRECIO POR CAJA USD 1.590,00 — caja cerrada de 10 unidades",
  evidenceIsSufficient: true,
  rejectionsAreExplained: true,
  anomalyIsReported: true,
  note: "Sin observaciones",
};

/** Respuesta fija del modelo simulado. */
function verdictResult(): LanguageModelV4GenerateResult {
  return {
    finishReason: { unified: "stop", raw: "stop" },
    usage: {
      inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: 10, text: 10, reasoning: 0 },
    },
    content: [{ type: "text", text: JSON.stringify(VERDICT) }],
    warnings: [],
  };
}

/** Registra el prompt recibido para poder inspeccionarlo después. */
function mockJudge(): { model: MockLanguageModelV4; prompts: string[] } {
  const prompts: string[] = [];

  const model = new MockLanguageModelV4({
    doGenerate: async (options) => {
      prompts.push(JSON.stringify(options.prompt));
      return verdictResult();
    },
  });

  return { model, prompts };
}

function comparison(): Comparison {
  return {
    quotes: [
      {
        supplier: "MayoristaZeta",
        unitPriceUsd: 159,
        freightUsd: 0,
        totalDeliveredUsd: 6360,
        leadTimeBusinessDays: 8,
        meetsLeadTime: true,
        meetsBudget: true,
        evidence: "PRECIO POR CAJA USD 1.590,00 — caja cerrada de 10 unidades",
      },
    ],
    noResponse: [{ supplier: "ImportAndina", status: "in_progress", detail: "Solicitud en cola." }],
    anomalies: [],
    recommendedSupplier: "MayoristaZeta",
    rationale: "Menor total puesto en bodega entre las que cumplen el plazo.",
  };
}

describe("verdictSchema", () => {
  it("exige la evidencia citada: un juicio sin cita no es auditable", () => {
    expect(verdictSchema.safeParse({ ...VERDICT, citedEvidence: "corto" }).success).toBe(false);
  });

  it("exige una observación para quien revisa el caso", () => {
    expect(verdictSchema.safeParse({ ...VERDICT, note: "" }).success).toBe(false);
  });
});

describe("judgeComparison", () => {
  it("produce un veredicto válido", async () => {
    const { model } = mockJudge();
    const verdict = await judgeComparison(comparison(), model);
    expect(verdict.evidenceIsSufficient).toBe(true);
  });

  it("recibe el resultado, no el razonamiento que lo produjo", async () => {
    // Un evaluador que ve el razonamiento tiende a validarlo. Solo entra el
    // comparativo serializado.
    const { model, prompts } = mockJudge();
    await judgeComparison(comparison(), model);

    const received = prompts.join("");
    expect(received).toContain("MayoristaZeta");
    expect(received).not.toContain("get_quote");
  });

  it("no dispone de herramientas", async () => {
    // Recibe un resultado y emite un juicio: concederle acceso le permitiría
    // buscar los datos por su cuenta y juzgar contra lo que encontrara.
    const tools: unknown[] = [];

    const model = new MockLanguageModelV4({
      doGenerate: async (options) => {
        tools.push(...(options.tools ?? []));
        return verdictResult();
      },
    });

    await judgeComparison(comparison(), model);
    expect(tools).toHaveLength(0);
  });
});
