/**
 * Instrumentación.
 *
 * La activación de trazas es una decisión de entorno, y el contrato de esa
 * variable conviene fijarlo: un valor que no se reconoce deja al sistema sin
 * observabilidad justo cuando se la pidió.
 *
 *     npm test -- tracing
 */

import { afterEach, describe, expect, it } from "vitest";

import { enableTracing, shutdownTracing, tracingRequested } from "../../src/platform/tracing.js";

const ORIGINAL = process.env["TRACING"];

afterEach(async () => {
  await shutdownTracing();
  if (ORIGINAL === undefined) delete process.env["TRACING"];
  else process.env["TRACING"] = ORIGINAL;
});

describe("tracingRequested", () => {
  it("reconoce las formas afirmativas admitidas", () => {
    for (const value of ["1", "si", "true", "TRUE", "Si"]) {
      process.env["TRACING"] = value;
      expect(tracingRequested(), `valor ${value}`).toBe(true);
    }
  });

  it("cualquier otro valor deja las trazas apagadas", () => {
    for (const value of ["0", "no", "false", ""]) {
      process.env["TRACING"] = value;
      expect(tracingRequested(), `valor ${value}`).toBe(false);
    }
  });

  it("sin la variable, apagadas", () => {
    delete process.env["TRACING"];
    expect(tracingRequested()).toBe(false);
  });
});

describe("enableTracing", () => {
  it("es idempotente: activarla dos veces no duplica la instrumentación", async () => {
    expect(() => {
      enableTracing();
      enableTracing();
    }).not.toThrow();

    await expect(shutdownTracing()).resolves.toBeUndefined();
  });

  it("cerrar sin haber activado no falla", async () => {
    await expect(shutdownTracing()).resolves.toBeUndefined();
  });
});
