/**
 * La puerta de entrada: qué gobierna la corrida después de admitir.
 *
 * Lo que se fija aquí no es el criterio del modelo sino el orden y sus efectos:
 * que una petición completa quede gobernando, que una incompleta y una con
 * datos inventados no gobiernen nada, y que lo que se fija sea exactamente lo
 * que después lee el resto del programa.
 *
 * La regresión que cubre es concreta. Mientras esta composición vivió dentro de
 * un script, `npm run agent` le daba al agente la petición del usuario y
 * verificaba el resultado contra el encargo del archivo, sin que nada fallara.
 *
 *     npm test -- admission
 */

import type { LanguageModelV4GenerateResult } from "@ai-sdk/provider";
import { MockLanguageModelV4 } from "ai/test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { admitRequest } from "../src/admission.js";
import { governWith, readBrief } from "../src/domain/catalog.js";

/** Lo que el modelo de admisión devolvería para una petición dada. */
function mockIntake(extraction: Record<string, unknown>): MockLanguageModelV4 {
  return new MockLanguageModelV4({
    doGenerate: async (): Promise<LanguageModelV4GenerateResult> => ({
      finishReason: { unified: "stop", raw: "stop" },
      usage: {
        inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 10, text: 10, reasoning: 0 },
      },
      content: [{ type: "text", text: JSON.stringify(extraction) }],
      warnings: [],
    }),
  });
}

const COMPLETA = {
  product: "Teclado inalámbrico",
  quantity: 100,
  maxLeadTimeBusinessDays: 5,
  budgetCapUsd: 3000,
  budgetIncludesFreight: true,
  warranty: null,
  citations: [
    { field: "product", quotation: "100 teclados inalámbricos" },
    { field: "quantity", quotation: "100 teclados" },
    { field: "maxLeadTimeBusinessDays", quotation: "5 días hábiles" },
    { field: "budgetCapUsd", quotation: "tope de 3.000 dólares" },
  ],
  severalProducts: false,
  missing: [],
  question: null,
  notes: null,
};

const PETICION = "Necesito 100 teclados inalámbricos en 5 días hábiles, con tope de 3.000 dólares.";

// `BRIEF_JSON` es proceso global: sin esto una prueba dejaría gobernando su
// requisición sobre las siguientes.
let previo: string | undefined;
beforeEach(() => {
  previo = process.env["BRIEF_JSON"];
  delete process.env["BRIEF_JSON"];
});
afterEach(() => {
  if (previo === undefined) delete process.env["BRIEF_JSON"];
  else process.env["BRIEF_JSON"] = previo;
});

describe("una petición completa queda gobernando", () => {
  it("devuelve la requisición admitida", async () => {
    const admission = await admitRequest(PETICION, mockIntake(COMPLETA));

    expect(admission.status).toBe("admitted");
    if (admission.status !== "admitted") return;
    expect(admission.brief.product).toBe("Teclado inalámbrico");
    expect(admission.brief.quantity).toBe(100);
    expect(admission.brief.budgetCapUsd).toBe(3000);
  });

  it("lo que se admite es lo que el resto del programa lee", async () => {
    // Es la comprobación que faltaba: admitir sin gobernar dejaba al agente
    // trabajando sobre un encargo y a las verificaciones sobre otro.
    await admitRequest(PETICION, mockIntake(COMPLETA));

    expect(readBrief().product).toBe("Teclado inalámbrico");
    expect(readBrief().quantity).toBe(100);
  });

  it("conserva los proveedores del caso, que son el mercado disponible", async () => {
    const admission = await admitRequest(PETICION, mockIntake(COMPLETA));

    if (admission.status !== "admitted") throw new Error("debió admitirse");
    expect(admission.brief.suppliers).toEqual(readBrief().suppliers);
    expect(admission.brief.suppliers.length).toBe(5);
  });
});

describe("lo que no alcanza no gobierna", () => {
  it("una petición sin presupuesto se detiene y enumera qué falta", async () => {
    const admission = await admitRequest(
      "Necesito 100 teclados en 5 días hábiles.",
      mockIntake({
        ...COMPLETA,
        budgetCapUsd: null,
        missing: [{ field: "budgetCapUsd", why: "La petición no declara tope." }],
        question: "¿Cuál es el presupuesto tope para esta compra?",
      }),
    );

    expect(admission.status).toBe("incomplete");
    expect(process.env["BRIEF_JSON"]).toBeUndefined();
  });

  it("un dato que no está en la petición no gobierna", async () => {
    // El modelo declara completa una petición cuyas citas no la respaldan.
    const admission = await admitRequest(
      "Necesito teclados.",
      mockIntake({
        ...COMPLETA,
        citations: [
          { field: "budgetCapUsd", quotation: "descuento por volumen ya pactado por teléfono" },
        ],
      }),
    );

    expect(admission.status).toBe("unfounded");
    expect(process.env["BRIEF_JSON"]).toBeUndefined();
  });

  it("varios productos no es un dato que falte, es uno que no se puede representar", async () => {
    const admission = await admitRequest(
      "Necesito 100 teclados y 40 monitores.",
      mockIntake({ ...COMPLETA, severalProducts: true }),
    );

    expect(admission.status).toBe("incomplete");
    expect(process.env["BRIEF_JSON"]).toBeUndefined();
  });
});

describe("los dos extremos del transporte", () => {
  it("lo que fija governWith es lo que devuelve readBrief", async () => {
    // Viven en el mismo módulo justamente para que no puedan separarse.
    const brief = { ...readBrief(), product: "Silla ergonómica", quantity: 7 };
    governWith(brief);

    expect(readBrief()).toEqual(brief);
  });

  it("sin nadie que fije nada, se lee el encargo del caso", () => {
    expect(readBrief().product).toContain("Monitor");
  });
});
