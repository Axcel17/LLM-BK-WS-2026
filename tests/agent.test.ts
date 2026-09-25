/**
 * Orquestación de la corrida.
 *
 * Cubre lo que se puede verificar sin llamar a un modelo: la construcción de
 * las instrucciones y la reconstrucción del expediente de traspaso.
 *
 *     npm test -- agent
 */

import { afterEach, describe, expect, it } from "vitest";

import { buildInstructions, buildTask, gatheredSoFar } from "../src/agent.js";

/** Las instrucciones vienen justificadas: una frase puede cruzar un salto. */
function flat(text: string): string {
  return text.replace(/\s+/g, " ");
}

const ORIGINAL = process.env["DROP_PROMPT_RULE"];

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env["DROP_PROMPT_RULE"];
  else process.env["DROP_PROMPT_RULE"] = ORIGINAL;
});

describe("buildInstructions", () => {
  it("por defecto conserva la regla de no adjudicar", () => {
    delete process.env["DROP_PROMPT_RULE"];

    const instructions = flat(buildInstructions());

    expect(instructions).toContain("No adjudicas");
    expect(instructions).toContain("menor total puesto en bodega");
  });

  it("la variante retira la regla 8 y conserva el criterio de desempate", () => {
    // El recorte se hizo una vez con una expresión que cortaba desde la regla
    // 7, y la variante quedaba además sin criterio de desempate: el agente
    // recomendaba mal por un motivo que nada tenía que ver con la compuerta.
    process.env["DROP_PROMPT_RULE"] = "1";

    const instructions = flat(buildInstructions());

    expect(instructions).not.toContain("No adjudicas");
    expect(instructions).toContain("menor total puesto en bodega");
  });
});

describe("buildTask", () => {
  it("la variante pide cerrar la compra, para que la compuerta tenga qué detener", () => {
    process.env["DROP_PROMPT_RULE"] = "1";
    expect(buildTask()).toMatch(/compra cerrada/i);

    delete process.env["DROP_PROMPT_RULE"];
    expect(buildTask()).not.toMatch(/compra cerrada/i);
  });
});

describe("gatheredSoFar", () => {
  it("empareja cada llamada con su resultado y mide lo devuelto", () => {
    const steps = [
      {
        toolCalls: [{ toolName: "get_brief", input: {} }],
        toolResults: [{ output: "cuatro" }],
      },
      {
        toolCalls: [
          { toolName: "get_quote", input: { supplier: "MayoristaZeta" } },
          { toolName: "get_quote", input: { supplier: "Tecnoimport" } },
        ],
        toolResults: [{ output: "diez chars" }, { output: "x" }],
      },
    ];

    expect(gatheredSoFar(steps)).toEqual([
      { tool: "get_brief", input: {}, characters: 6 },
      { tool: "get_quote", input: { supplier: "MayoristaZeta" }, characters: 10 },
      { tool: "get_quote", input: { supplier: "Tecnoimport" }, characters: 1 },
    ]);
  });

  it("una llamada sin resultado no rompe el expediente", () => {
    // Al cortarse el bucle, el último paso puede tener la llamada emitida y
    // el resultado todavía no.
    const steps = [{ toolCalls: [{ toolName: "get_brief", input: {} }], toolResults: [] }];

    expect(gatheredSoFar(steps)).toEqual([{ tool: "get_brief", input: {}, characters: 0 }]);
  });

  it("sin pasos no hay nada que traspasar", () => {
    expect(gatheredSoFar([])).toEqual([]);
  });
});
