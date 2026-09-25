/**
 * Selección de proveedor de modelo.
 *
 * El proveedor interviene en un solo módulo, y esa es justamente la propiedad
 * que conviene fijar con pruebas: un cambio de proveedor no debe requerir
 * tocar nada más.
 *
 *     npm test -- providers
 */

import type { LanguageModel } from "ai";
import { afterEach, describe, expect, it } from "vitest";

import { resolveModel } from "../../src/platform/providers.js";

/** `LanguageModel` admite también un identificador en texto. */
function modelIdOf(model: LanguageModel): string {
  return typeof model === "string" ? model : model.modelId;
}

const KEYS = [
  "PROVIDER",
  "MODEL",
  "JUDGE_PROVIDER",
  "JUDGE_MODEL",
  "GOOGLE_API_KEY",
  "OPENAI_API_KEY",
];
const ORIGINAL = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of KEYS) {
    const value = ORIGINAL[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

function only(vars: Record<string, string>): void {
  for (const key of KEYS) delete process.env[key];
  Object.assign(process.env, vars);
}

describe("resolveModel", () => {
  it("construye el modelo del proveedor indicado", () => {
    only({ PROVIDER: "openai", MODEL: "gpt-5.4-mini", OPENAI_API_KEY: "clave-de-prueba" });
    expect(modelIdOf(resolveModel("agent"))).toBe("gpt-5.4-mini");
  });

  it("el evaluador puede usar un proveedor distinto del agente", () => {
    only({
      PROVIDER: "google",
      MODEL: "gemini-3.1-flash-lite",
      JUDGE_PROVIDER: "openai",
      JUDGE_MODEL: "gpt-5.4-mini",
      GOOGLE_API_KEY: "clave-google",
      OPENAI_API_KEY: "clave-openai",
    });

    expect(modelIdOf(resolveModel("agent"))).toBe("gemini-3.1-flash-lite");
    expect(modelIdOf(resolveModel("judge"))).toBe("gpt-5.4-mini");
  });

  it("sin configuración del evaluador, hereda la del agente", () => {
    only({ PROVIDER: "openai", MODEL: "gpt-5.4-mini", OPENAI_API_KEY: "clave-de-prueba" });
    expect(modelIdOf(resolveModel("judge"))).toBe("gpt-5.4-mini");
  });

  it("una clave ausente falla con el nombre de la variable que falta", () => {
    only({ PROVIDER: "openai", MODEL: "gpt-5.4-mini" });
    expect(() => resolveModel("agent")).toThrow(/OPENAI_API_KEY/);
  });

  it("un proveedor no reconocido falla antes de intentar una llamada", () => {
    only({ PROVIDER: "proveedor-inexistente", OPENAI_API_KEY: "clave" });
    expect(() => resolveModel("agent")).toThrow(/no reconocido/i);
  });
});
