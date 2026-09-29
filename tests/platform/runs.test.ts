/**
 * Bitácora de corridas.
 *
 * Lo que se fija aquí es que registrar nunca estorbe: una corrida que funcionó
 * no puede convertirse en fallida porque la bitácora no se pudo escribir, y un
 * paso cortado a mitad tiene que quedar registrado igual.
 *
 *     npm test -- runs
 */

import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  embedRuns,
  recordRun,
  recordSteps,
  runId,
  type RunRecord,
} from "../../src/platform/runs.js";

function record(overrides: Partial<RunRecord> = {}): RunRecord {
  return {
    id: "2026-09-29T00-00-00-000",
    startedAt: "2026-09-29T00:00:00.000Z",
    durationMs: 12000,
    provider: "openai",
    model: "gpt-5.4-mini",
    maxSteps: 12,
    request: null,
    outcome: "completa",
    steps: [],
    totals: { inputTokens: 3929, outputTokens: 1100, cachedInputTokens: 2048 },
    comparison: null,
    findings: [],
    verdict: null,
    verdictError: null,
    denied: [],
    integrity: null,
    error: null,
    ...overrides,
  };
}

describe("runId", () => {
  it("es ordenable alfabéticamente y válido como nombre de archivo", () => {
    const antes = runId(new Date("2026-09-29T10:00:00.000Z"));
    const later = runId(new Date("2026-09-29T10:00:01.000Z"));

    expect(antes < later).toBe(true);
    // Los dos puntos de una hora ISO no son válidos en todos los sistemas.
    expect(antes).not.toMatch(/[:.]/);
  });
});

describe("recordSteps", () => {
  it("empareja cada llamada con su resultado y recorta lo devuelto", () => {
    const long = "x".repeat(500);
    const steps = [
      {
        toolCalls: [{ toolName: "get_quote", input: { supplier: "MayoristaZeta" } }],
        toolResults: [{ output: long }],
        usage: { inputTokens: 950, outputTokens: 101 },
      },
    ];

    const [step] = recordSteps(steps);

    expect(step?.calls[0]?.tool).toBe("get_quote");
    expect(step?.calls[0]?.characters).toBe(500);
    // El texto crudo de cinco cotizaciones no cabe en un visor: se recorta.
    expect(step?.calls[0]?.preview.length).toBeLessThan(500);
    expect(step?.inputTokens).toBe(950);
  });

  it("una llamada sin resultado no rompe la bitácora", () => {
    // Al cortarse el bucle en el tope, el último paso puede tener la llamada
    // emitida y el resultado todavía no. Es el caso que más interesa registrar.
    const [step] = recordSteps([
      { toolCalls: [{ toolName: "get_brief", input: {} }], toolResults: [] },
    ]);

    expect(step?.calls[0]?.characters).toBe(0);
    expect(step?.inputTokens).toBeNull();
  });

  it("un paso sin llamadas es el que produce la salida estructurada", () => {
    const [step] = recordSteps([{ toolCalls: [], toolResults: [] }]);
    expect(step?.calls).toEqual([]);
  });
});

describe("embedRuns", () => {
  it("escapa `<` para que un dato no cierre la etiqueta script", () => {
    // Una cotización puede traer HTML. Sin escapar, un `</script>` dentro de
    // los datos parte la página en dos y la deja muda, sin error visible: la
    // falla silenciosa que este taller enseña a no dejar al azar.
    const withHtml = record({
      error: "el proveedor devolvió </script><script>alert(1)</script>",
    });

    const serialized = embedRuns([withHtml]);

    expect(serialized).not.toContain("</script>");
    expect(serialized).toContain("\\u003c");
    // Y sigue siendo JSON válido, que es la otra mitad del contrato.
    expect(JSON.parse(serialized.replace(/\\u003c/g, "<"))).toHaveLength(1);
  });

  it("sin corridas produce una lista vacía, no `undefined`", () => {
    expect(embedRuns([])).toBe("[]");
  });
});

describe("recordRun", () => {
  const folders: string[] = [];

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    for (const c of folders.splice(0)) rmSync(c, { recursive: true, force: true });
  });

  it("escribe la bitácora y devuelve su ruta", () => {
    const base = mkdtempSync(join(tmpdir(), "corridas-"));
    folders.push(base);
    vi.spyOn(process, "cwd").mockReturnValue(base);

    const file = recordRun(record({ id: "prueba" }));

    expect(file).not.toBeNull();
    const written = JSON.parse(readFileSync(file as string, "utf8")) as RunRecord;
    expect(written.model).toBe("gpt-5.4-mini");
    expect(written.totals.cachedInputTokens).toBe(2048);
  });

  it("si no puede escribir, lo informa y devuelve null en vez de lanzar", () => {
    // Una corrida que funcionó no se convierte en fallida porque el disco esté
    // lleno o la carpeta sea de solo lectura.
    vi.spyOn(process, "cwd").mockReturnValue("/no/existe/y/no/se/puede/crear");
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => recordRun(record())).not.toThrow();
    expect(recordRun(record())).toBeNull();
    expect(error).toHaveBeenCalled();
  });
});
