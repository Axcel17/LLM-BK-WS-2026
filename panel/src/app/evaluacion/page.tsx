"use client";

import { useRef, useState } from "react";
import { Check, ChevronRight, Loader2, Play, Square, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Esperado = Record<string, boolean>;

type Ejecucion = {
  indice: number;
  pasada: number;
  nombre: string;
  aisla: string;
  esperado: Esperado;
  comparativo: unknown;
  estado: "corriendo" | "listo";
  acuerdos: number;
  veredicto: Record<string, boolean | string> | null;
  error: string | null;
};

const CRITERIOS = ["evidenceIsSufficient", "rejectionsAreExplained", "anomalyIsReported"] as const;

const ETIQUETA: Record<string, string> = {
  evidenceIsSufficient: "Evidencia suficiente",
  rejectionsAreExplained: "Descartes justificados",
  anomalyIsReported: "Anomalía reportada",
  ninguno: "Control negativo",
};

function Criterio({
  nombre,
  esperado,
  obtenido,
}: {
  nombre: string;
  esperado: boolean;
  obtenido: boolean | undefined;
}) {
  const coincide = obtenido === esperado;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={cn("shrink-0", coincide ? "text-verificado" : "text-destructive")}>
        {coincide ? "✓" : "✕"}
      </span>
      <span className="text-muted-foreground min-w-0 flex-1 truncate">{ETIQUETA[nombre]}</span>
      <span className="tabular text-muted-foreground font-mono">
        esperado {String(esperado)} · obtenido {obtenido === undefined ? "—" : String(obtenido)}
      </span>
    </div>
  );
}

export default function Evaluacion() {
  const [pasadas, setPasadas] = useState(1);
  const [ejecuciones, setEjecuciones] = useState<Ejecucion[]>([]);
  const [total, setTotal] = useState(0);
  const [esperado, setEsperado] = useState(0);
  const [corriendo, setCorriendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);
  const cancelar = useRef<AbortController | null>(null);

  const acuerdos = ejecuciones.reduce((s, e) => s + e.acuerdos, 0);
  const juzgados = ejecuciones.filter((e) => e.estado === "listo").length * CRITERIOS.length;
  const pct = juzgados > 0 ? Math.round((acuerdos / juzgados) * 100) : null;
  const avance = esperado > 0 ? Math.round((juzgados / esperado) * 100) : 0;

  async function correr() {
    setCorriendo(true);
    setError(null);
    setEjecuciones([]);
    setTotal(0);
    setEsperado(0);

    const control = new AbortController();
    cancelar.current = control;

    try {
      const r = await fetch("/api/evaluacion", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pasadas }),
        signal: control.signal,
      });
      if (!r.body) throw new Error("El servidor no devolvió un flujo");

      const lector = r.body.getReader();
      const decodificador = new TextDecoder();
      let resto = "";

      for (;;) {
        const { done, value } = await lector.read();
        if (done) break;
        resto += decodificador.decode(value, { stream: true });
        const lineas = resto.split("\n");
        resto = lineas.pop() ?? "";

        for (const linea of lineas) {
          if (linea.trim() === "") continue;
          let e: Record<string, unknown>;
          try {
            e = JSON.parse(linea) as Record<string, unknown>;
          } catch {
            continue;
          }

          if (e["tipo"] === "inicio") setEsperado(Number(e["total"]));
          if (e["tipo"] === "error") setError(String(e["texto"]));

          if (e["tipo"] === "caso-empieza") {
            setEjecuciones((prev) => [
              ...prev,
              {
                indice: Number(e["indice"]),
                pasada: Number(e["pasada"]),
                nombre: String(e["nombre"]),
                aisla: String(e["aisla"]),
                esperado: e["esperado"] as Esperado,
                comparativo: e["comparativo"],
                estado: "corriendo",
                acuerdos: 0,
                veredicto: null,
                error: null,
              },
            ]);
          }

          if (e["tipo"] === "caso-termina") {
            setEjecuciones((prev) =>
              prev.map((x) =>
                x.indice === Number(e["indice"]) && x.pasada === Number(e["pasada"])
                  ? {
                      ...x,
                      estado: "listo",
                      acuerdos: Number(e["acuerdos"]),
                      veredicto: e["veredicto"] as Ejecucion["veredicto"],
                      error: (e["error"] as string | null) ?? null,
                    }
                  : x,
              ),
            );
          }

          if (e["tipo"] === "fin") setTotal(Number(e["total"]));
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
    } finally {
      setCorriendo(false);
      cancelar.current = null;
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl overflow-y-auto px-4 py-10">
      <header>
        <h1 className="text-[1.65rem] leading-tight font-semibold tracking-tight text-balance">
          Validación de la capa de evaluación
        </h1>
        <p className="text-muted-foreground mt-2.5 max-w-xl text-[0.94rem] leading-relaxed">
          El evaluador por modelo dictamina sobre las salidas del agente. Este procedimiento lo
          somete a su vez a control: se le presentan cuatro comparativos de veredicto conocido —tres
          con un defecto introducido de forma deliberada y uno correcto— y se contabiliza la
          coincidencia por criterio. El agente no interviene en la ejecución, de modo que toda
          discrepancia es atribuible al evaluador.
        </p>
      </header>

      <div className="border-border/70 mt-8 flex flex-wrap items-center gap-3 rounded-2xl border p-3">
        <div className="bg-muted/60 flex items-center gap-0.5 rounded-xl p-0.5">
          {[1, 3, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setPasadas(n)}
              disabled={corriendo}
              aria-pressed={pasadas === n}
              className={cn(
                "rounded-[0.6rem] px-3 py-1.5 text-sm transition-colors disabled:opacity-50",
                pasadas === n
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              ×{n}
            </button>
          ))}
        </div>

        {corriendo ? (
          <Button
            variant="outline"
            className="rounded-xl"
            onClick={() => cancelar.current?.abort()}
          >
            <Square className="size-3.5" /> Interrumpir
          </Button>
        ) : (
          <Button onClick={() => void correr()} className="rounded-xl">
            <Play className="size-4" /> Ejecutar
          </Button>
        )}

        <span className="text-muted-foreground tabular text-xs">
          {4 * pasadas} invocaciones · {4 * pasadas * 3} dictámenes
        </span>

        {pct !== null && (
          <div className="ml-auto flex items-baseline gap-2">
            <span
              className={cn(
                "tabular text-2xl font-semibold tracking-tight",
                pct === 100 ? "text-verificado" : "text-destructive",
              )}
            >
              {pct} %
            </span>
            <span className="text-muted-foreground tabular text-xs">
              {acuerdos}/{total || juzgados}
            </span>
          </div>
        )}
      </div>

      {esperado > 0 && (
        <div className="bg-muted mt-3 h-1 overflow-hidden rounded-full">
          <div
            className="bg-primary h-full rounded-full transition-[width] duration-300"
            style={{ width: `${avance}%` }}
          />
        </div>
      )}

      {error && (
        <p className="border-destructive/40 bg-destructive/5 text-destructive mt-4 rounded-xl border px-4 py-3 text-sm">
          {error}
        </p>
      )}

      <div className="mt-4 space-y-2">
        {ejecuciones.map((e) => {
          const clave = `${e.indice}-${e.pasada}`;
          const bien = e.estado === "listo" && e.acuerdos === CRITERIOS.length;
          const desplegado = abierto === clave;

          return (
            <div
              key={clave}
              className={cn(
                "rounded-xl border transition-colors",
                e.estado === "corriendo"
                  ? "border-primary/40 bg-accent/25"
                  : bien
                    ? "border-border/70"
                    : "border-destructive/45 bg-destructive/[0.03]",
              )}
            >
              <button
                type="button"
                onClick={() => setAbierto(desplegado ? null : clave)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left"
              >
                {e.estado === "corriendo" ? (
                  <Loader2 className="text-primary size-4 shrink-0 animate-spin" aria-hidden />
                ) : bien ? (
                  <Check className="text-verificado size-4 shrink-0" aria-hidden />
                ) : (
                  <X className="text-destructive size-4 shrink-0" aria-hidden />
                )}

                <span className="min-w-0 flex-1 truncate text-sm font-medium">{e.nombre}</span>

                {pasadas > 1 && (
                  <span className="text-muted-foreground tabular font-mono text-[11px]">
                    #{e.pasada}
                  </span>
                )}
                <span className="bg-muted text-muted-foreground rounded-md px-2 py-0.5 font-mono text-[11px]">
                  {ETIQUETA[e.aisla] ?? e.aisla}
                </span>
                <span className="text-muted-foreground tabular w-9 text-right text-sm">
                  {e.estado === "corriendo" ? "…" : `${e.acuerdos}/3`}
                </span>
                <ChevronRight
                  className={cn(
                    "text-muted-foreground size-4 shrink-0 transition-transform",
                    desplegado && "rotate-90",
                  )}
                  aria-hidden
                />
              </button>

              {desplegado && (
                <div className="space-y-3 border-t px-4 py-3">
                  <div className="space-y-1">
                    {CRITERIOS.map((c) => (
                      <Criterio
                        key={c}
                        nombre={c}
                        esperado={e.esperado[c] ?? false}
                        obtenido={e.veredicto?.[c] as boolean | undefined}
                      />
                    ))}
                  </div>

                  {e.error && <p className="text-destructive font-mono text-xs">{e.error}</p>}

                  {typeof e.veredicto?.["note"] === "string" && (
                    <p className="text-muted-foreground border-l-2 pl-3 text-xs italic">
                      « {e.veredicto["note"]} »
                    </p>
                  )}

                  <details>
                    <summary className="text-muted-foreground cursor-pointer text-xs">
                      Comparativo presentado al evaluador
                    </summary>
                    <pre className="bg-muted/50 mt-2 max-h-64 overflow-auto rounded-lg p-3 font-mono text-[11px] leading-relaxed">
                      {JSON.stringify(e.comparativo, null, 2)}
                    </pre>
                  </details>
                </div>
              )}
            </div>
          );
        })}

        {ejecuciones.length === 0 && !corriendo && (
          <div className="border-border/60 text-muted-foreground rounded-xl border border-dashed px-4 py-12 text-center text-sm">
            Sin ejecuciones registradas
          </div>
        )}
      </div>

      {total > 0 && (
        <p className="text-muted-foreground mt-6 border-t pt-5 text-xs leading-relaxed">
          Mide la coincidencia con las etiquetas declaradas en{" "}
          <code className="bg-muted rounded px-1 py-0.5">judge-cases.ts</code>, no la corrección
          absoluta del dictamen. Ante una discrepancia defendible, lo que corresponde revisar es la
          etiqueta.
        </p>
      )}
    </div>
  );
}
