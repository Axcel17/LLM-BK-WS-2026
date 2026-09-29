import { AlertTriangle, Check, CircleSlash, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { configuracion, leerCorridas, type Corrida } from "@/lib/taller";

export const dynamic = "force-dynamic";

function seg(ms: number) {
  return `${(ms / 1000).toFixed(1)} s`;
}

function estado(c: Corrida) {
  if (c.outcome === "tope-alcanzado")
    return { Icono: AlertTriangle, clase: "text-firma", texto: "límite alcanzado" };
  if (c.outcome === "error")
    return { Icono: CircleSlash, clase: "text-destructive", texto: "error" };
  if (c.findings.length > 0)
    return { Icono: X, clase: "text-destructive", texto: `${c.findings.length} hallazgo(s)` };
  return { Icono: Check, clase: "text-verificado", texto: "conforme" };
}

function Metrica({ valor, etiqueta }: { valor: string; etiqueta: string }) {
  return (
    <div>
      <div className="tabular text-[1.6rem] leading-none font-semibold tracking-tight">{valor}</div>
      <div className="text-muted-foreground mt-1.5 text-[11px] tracking-wide uppercase">
        {etiqueta}
      </div>
    </div>
  );
}

export default function Monitoreo() {
  const corridas = leerCorridas();
  const config = configuracion();

  const completas = corridas.filter((c) => c.outcome === "completa");
  const limpias = completas.filter((c) => c.findings.length === 0);
  const medianaMs = (() => {
    const t = completas.map((c) => c.durationMs).sort((a, b) => a - b);
    return t.length === 0 ? 0 : (t[Math.floor(t.length / 2)] ?? 0);
  })();
  const entrada = completas.reduce((s, c) => s + c.totals.inputTokens, 0);
  const cacheado = completas.reduce((s, c) => s + c.totals.cachedInputTokens, 0);

  return (
    <div className="mx-auto w-full max-w-4xl overflow-y-auto px-4 py-10">
      <header className="mb-7">
        <h1 className="text-[1.65rem] leading-tight font-semibold tracking-tight">
          Historial de ejecuciones
        </h1>
        <p className="text-muted-foreground mt-1.5 max-w-xl text-sm">
          Registro de las ejecuciones de{" "}
          <code className="bg-muted rounded px-1 py-0.5">npm run agent</code>. Esta consola las
          consulta; no las genera.
        </p>
      </header>

      {corridas.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="text-muted-foreground py-12 text-center text-sm">
            <p>Sin ejecuciones registradas.</p>
            <p className="mt-2">
              Ejecute <code className="bg-muted rounded px-1.5 py-0.5">npm run agent</code> y
              actualice esta vista.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="mb-7">
            <CardContent className="grid grid-cols-2 gap-6 py-5 sm:grid-cols-4">
              <Metrica valor={String(corridas.length)} etiqueta="ejecuciones" />
              <Metrica
                valor={`${limpias.length}/${completas.length || 0}`}
                etiqueta="sin hallazgos"
              />
              <Metrica valor={seg(medianaMs)} etiqueta="duración mediana" />
              <Metrica
                valor={entrada > 0 ? `${Math.round((cacheado / entrada) * 100)} %` : "—"}
                etiqueta="servido de caché"
              />
            </CardContent>
          </Card>

          <div className="mb-7 flex flex-wrap gap-2 text-xs">
            {[
              ["proveedor", config.proveedor],
              ["modelo", config.modelo],
              ["evaluador", config.evaluador],
              ["tope de pasos", String(config.topeDePasos)],
            ].map(([k, v]) => (
              <Badge key={k} variant="secondary" className="font-normal">
                <span className="text-muted-foreground mr-1.5">{k}</span>
                {v}
              </Badge>
            ))}
            {config.reglaRetirada && <Badge variant="destructive">DROP_PROMPT_RULE activa</Badge>}
          </div>

          <div className="grid gap-3">
            {corridas.map((c) => {
              const { Icono, clase, texto } = estado(c);
              const plan = c.steps.flatMap((p) =>
                p.calls.map(
                  (l) => l.tool + (l.input ? `(${Object.values(l.input).join(", ")})` : ""),
                ),
              );

              return (
                <Card key={c.id}>
                  <CardContent className="space-y-3 py-4">
                    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                      <span className={`flex items-center gap-1.5 text-sm font-medium ${clase}`}>
                        <Icono className="size-4 shrink-0" aria-hidden />
                        {texto}
                      </span>
                      <span className="text-sm tabular-nums">
                        {new Date(c.startedAt).toLocaleString("es", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </span>
                      <span className="text-muted-foreground text-xs">{c.model}</span>
                      <span className="text-muted-foreground text-xs tabular-nums">
                        {seg(c.durationMs)} · {c.steps.length} pasos ·{" "}
                        {c.totals.inputTokens.toLocaleString("es")} tokens
                      </span>
                      {c.comparison?.recommendedSupplier && (
                        <Badge variant="outline" className="ml-auto text-xs">
                          → {c.comparison.recommendedSupplier}
                        </Badge>
                      )}
                    </div>

                    {c.request && (
                      <p className="border-foreground/20 text-muted-foreground border-l-2 pl-3 text-xs italic">
                        Consulta del usuario: {c.request}
                      </p>
                    )}

                    {plan.length > 0 && (
                      <p className="text-muted-foreground font-mono text-xs leading-relaxed">
                        {plan.join("  →  ")}
                      </p>
                    )}

                    {c.findings.map((f, i) => (
                      <p
                        key={i}
                        className="border-destructive/60 border-l-2 py-0.5 pl-3 text-xs leading-relaxed"
                      >
                        <span className="text-destructive font-mono">[{f.check}]</span> {f.detail}
                      </p>
                    ))}

                    {c.denied.map((d, i) => (
                      <p
                        key={i}
                        className="border-destructive bg-destructive/5 rounded border-l-2 px-3 py-1.5 font-mono text-xs"
                      >
                        <span className="text-destructive font-semibold">DENEGADO</span> {d.tool}(
                        {Object.values(d.input as Record<string, unknown>).join(", ")})
                      </p>
                    ))}

                    {c.verdict && (
                      <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 border-t pt-2.5 text-xs">
                        {(
                          [
                            ["evidencia", c.verdict.evidenceIsSufficient],
                            ["descartes", c.verdict.rejectionsAreExplained],
                            ["anomalía", c.verdict.anomalyIsReported],
                          ] as const
                        ).map(([n, v]) => (
                          <span key={n}>
                            {v ? "✓" : "✕"} {n}
                          </span>
                        ))}
                        <span className="italic">« {c.verdict.note} »</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
