"use client";

import { Check, ChevronRight, Loader2, Play, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CaseOutcome, WorkshopCase } from "@/lib/workshop";

/**
 * Los casos probados, ejecutables uno por uno.
 *
 * Responden una sola pregunta y hay que responderla corriendo: **¿el agente
 * sigue resolviendo lo que ya resolvía?** Un modelo nuevo, una regla retocada o
 * un proveedor con otro plazo lo cambian sin avisar.
 *
 * Por eso aquí no se lee ninguna bitácora. Cada botón lanza la corrida completa
 * —admisión, consulta a los cinco proveedores, verificación y evaluador— y lo
 * que se muestra es lo que acaba de pasar. Una corrida guardada dice lo que
 * pasó una vez; la pregunta es si pasa hoy.
 */
export function CaseBank({ cases }: { cases: WorkshopCase[] }) {
  const [results, setResults] = useState<Record<string, CaseOutcome | null>>({});
  const [running, setRunning] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<string | null>(null);

  async function run(id: string) {
    if (running.includes(id)) return;
    setRunning((r) => [...r, id]);
    setErrors(({ [id]: _, ...rest }) => rest);
    setResults((r) => ({ ...r, [id]: null }));

    try {
      const response = await fetch("/api/caso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = (await response.json()) as CaseOutcome & { error?: string };
      if (!response.ok || data.assertions === undefined) {
        setErrors((e) => ({ ...e, [id]: data.error ?? "La corrida no devolvió resultado." }));
      } else {
        setResults((r) => ({ ...r, [id]: data }));
        setOpen(id);
      }
    } catch (error) {
      setErrors((e) => ({ ...e, [id]: (error as Error).message }));
    } finally {
      setRunning((r) => r.filter((x) => x !== id));
    }
  }

  async function runAll() {
    for (const c of cases) await run(c.id);
  }

  const done = cases.filter((c) => results[c.id]);
  const passing = done.filter((c) => results[c.id]?.ok).length;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Casos probados</h1>
          <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
            Cada caso trae la respuesta que el catálogo obliga. Ejecutar uno corre el flujo completo
            y compara contra ella — no lee ninguna corrida anterior.
          </p>
        </div>
        <Button onClick={() => void runAll()} disabled={running.length > 0} className="rounded-xl">
          <Play className="size-4" /> Ejecutar todos
        </Button>
      </div>

      {done.length > 0 && (
        <p className="text-muted-foreground border-border/60 mt-5 border-t pt-4 text-sm">
          <span
            className={cn(
              "font-medium",
              passing === done.length ? "text-verificado" : "text-destructive",
            )}
          >
            {passing} de {done.length}
          </span>{" "}
          {done.length === 1 ? "caso ejecutado cumple" : "casos ejecutados cumplen"} su respuesta
          conocida.
        </p>
      )}

      <ul className="mt-5 space-y-3">
        {cases.map((c) => {
          const result = results[c.id] ?? null;
          const busy = running.includes(c.id);
          const error = errors[c.id];
          const expanded = open === c.id;

          return (
            <li key={c.id} className="border-border/60 bg-card/40 rounded-xl border">
              <div className="flex items-start gap-3 px-4 py-3.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-medium">{c.nombre}</h2>
                    {result !== null && (
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[11px] font-medium",
                          result.ok
                            ? "bg-verificado/10 text-verificado"
                            : "bg-destructive/10 text-destructive",
                        )}
                      >
                        {result.assertions.filter((a) => a.ok).length}/{result.assertions.length}
                      </span>
                    )}
                  </div>
                  <p className="text-muted-foreground mt-1 font-mono text-xs leading-relaxed">
                    «{c.peticion}»
                  </p>
                  <p className="text-muted-foreground mt-1.5 text-xs leading-relaxed">{c.porQue}</p>
                </div>

                <Button
                  size="sm"
                  variant={result === null ? "default" : "outline"}
                  onClick={() => void run(c.id)}
                  disabled={busy}
                  className="shrink-0 rounded-lg"
                >
                  {busy ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" /> Corriendo
                    </>
                  ) : (
                    <>
                      <Play className="size-3.5" /> {result === null ? "Ejecutar" : "Repetir"}
                    </>
                  )}
                </Button>
              </div>

              {error !== undefined && (
                <p className="border-destructive/30 bg-destructive/5 text-destructive mx-4 mb-3.5 rounded-lg border px-3 py-2 text-xs break-words">
                  {error}
                </p>
              )}

              {result !== null && (
                <div className="border-border/60 border-t">
                  <ul className="space-y-1.5 px-4 py-3">
                    {result.assertions.map((a) => (
                      <li key={a.what} className="flex items-start gap-2 text-xs">
                        {a.ok ? (
                          <Check className="text-verificado mt-0.5 size-3.5 shrink-0" />
                        ) : (
                          <X className="text-destructive mt-0.5 size-3.5 shrink-0" />
                        )}
                        <span className="min-w-0 flex-1">{a.what}</span>
                        <span className="text-muted-foreground tabular shrink-0 font-mono">
                          {a.ok ? a.actual : `${a.actual} ≠ ${a.expected}`}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <button
                    type="button"
                    onClick={() => setOpen(expanded ? null : c.id)}
                    className="text-muted-foreground hover:text-foreground border-border/60 flex w-full items-center gap-1.5 border-t px-4 py-2 text-xs"
                  >
                    <ChevronRight
                      className={cn("size-3.5 transition-transform", expanded && "rotate-90")}
                    />
                    Qué hizo el agente
                  </button>

                  {expanded && <Trace result={result} />}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Lo que la corrida produjo, para poder mirarlo y no solo creer el veredicto. */
function Trace({ result }: { result: CaseOutcome }) {
  const { traza } = result;

  return (
    <div className="border-border/60 space-y-3 border-t px-4 py-3 text-xs">
      <Row label="Admisión" value={traza.admision} />

      {traza.comparativo !== null && (
        <div>
          <p className="text-muted-foreground mb-1.5">Comparativo</p>
          <table className="w-full">
            <tbody>
              {traza.comparativo.quotes.map((q) => (
                <tr key={q.supplier} className="border-border/40 border-b last:border-0">
                  <td className="py-1">
                    {q.supplier === traza.recomendado && (
                      <span className="text-verificado mr-1.5">▸</span>
                    )}
                    {q.supplier}
                  </td>
                  <td className="tabular py-1 text-right font-mono">
                    {q.totalDeliveredUsd.toLocaleString("es")}
                  </td>
                  <td className="text-muted-foreground py-1 pl-3 text-right">
                    {q.meetsLeadTime ? "" : "fuera de plazo"}
                    {q.meetsBudget ? "" : " · excede tope"}
                  </td>
                </tr>
              ))}
              {traza.comparativo.noResponse.map((n) => (
                <tr key={n.supplier} className="border-border/40 border-b last:border-0">
                  <td className="text-muted-foreground py-1">{n.supplier}</td>
                  <td colSpan={2} className="text-muted-foreground py-1 text-right">
                    {n.reason ?? "sin cotización"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {traza.anomalias.length > 0 && (
        <Row label="Anomalías reportadas" value={traza.anomalias.join(", ")} />
      )}

      {traza.hallazgos.length > 0 && (
        <div>
          <p className="text-destructive mb-1.5">Capa 1 · verificación por código</p>
          <ul className="space-y-1">
            {traza.hallazgos.map((h) => (
              <li key={h.detail} className="text-muted-foreground">
                <span className="font-mono">[{h.check}]</span> {h.detail}
              </li>
            ))}
          </ul>
        </div>
      )}

      {traza.veredicto !== null && (
        <Row
          label="Capa 2 · evaluador"
          value={
            `evidencia ${traza.veredicto.evidencia ? "sí" : "no"} · ` +
            `descartes ${traza.veredicto.descartes ? "sí" : "no"} · ` +
            `anomalía ${traza.veredicto.anomalia ? "sí" : "no"}`
          }
        />
      )}

      {result.error !== null && <p className="text-muted-foreground">{result.error}</p>}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="min-w-0 flex-1 break-words">{value}</span>
    </div>
  );
}
