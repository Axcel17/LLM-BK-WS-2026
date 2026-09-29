"use client";

import { useState } from "react";
import { Check, Loader2, Play, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Resultado = {
  nombre: string;
  aisla: string;
  esperado: Record<string, boolean>;
  acuerdos: number;
  total: number;
  desacuerdos: string[];
};

type Respuesta = {
  pasadas: number;
  resultados: Resultado[];
  acuerdos: number;
  total: number;
};

const ETIQUETA: Record<string, string> = {
  evidenceIsSufficient: "evidencia",
  rejectionsAreExplained: "descartes",
  anomalyIsReported: "anomalía",
  ninguno: "contrapeso",
};

export default function Evaluacion() {
  const [pasadas, setPasadas] = useState(1);
  const [datos, setDatos] = useState<Respuesta | null>(null);
  const [corriendo, setCorriendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function correr() {
    setCorriendo(true);
    setError(null);
    try {
      const r = await fetch("/api/evaluacion", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pasadas }),
      });
      if (!r.ok) throw new Error(`El servidor respondió ${r.status}`);
      setDatos((await r.json()) as Respuesta);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCorriendo(false);
    }
  }

  const pct = datos && datos.total > 0 ? Math.round((datos.acuerdos / datos.total) * 100) : null;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <header className="mb-7">
        <h1 className="text-2xl font-semibold tracking-tight">Evaluación del evaluador</h1>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-relaxed">
          La capa 2 juzga las salidas del agente. Esto juzga a la capa 2: cuatro comparativos con
          veredicto conocido, tres con un defecto plantado y uno correcto. El agente no interviene,
          y por eso un desacuerdo se le puede atribuir al evaluador y a nadie más.
        </p>
      </header>

      <div className="mb-7 flex flex-wrap items-center gap-3">
        <div className="border-border/70 flex items-center gap-1 rounded-lg border p-1">
          {[1, 3, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setPasadas(n)}
              aria-pressed={pasadas === n}
              className={cn(
                "rounded-md px-3 py-1 text-sm transition-colors",
                pasadas === n ? "bg-foreground text-background" : "hover:bg-muted",
              )}
            >
              {n} {n === 1 ? "pasada" : "pasadas"}
            </button>
          ))}
        </div>

        <Button onClick={() => void correr()} disabled={corriendo}>
          {corriendo ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Evaluando…
            </>
          ) : (
            <>
              <Play className="size-4" /> Ejecutar
            </>
          )}
        </Button>

        <span className="text-muted-foreground text-xs tabular-nums">
          {4 * pasadas} llamadas al modelo
        </span>

        {pct !== null && (
          <Badge
            variant={pct === 100 ? "default" : "destructive"}
            className="ml-auto text-sm tabular-nums"
          >
            acuerdo {datos?.acuerdos}/{datos?.total} · {pct} %
          </Badge>
        )}
      </div>

      {error && (
        <div className="border-destructive/40 bg-destructive/5 text-destructive mb-6 rounded-lg border px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <div className="grid gap-3">
        {(datos?.resultados ?? []).map((r) => {
          const bien = r.desacuerdos.length === 0;
          return (
            <Card key={r.nombre} className={cn(!bien && "border-destructive/50")}>
              <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
                <CardTitle className="flex items-center gap-2.5 text-base font-medium">
                  {bien ? (
                    <Check className="text-primary size-4 shrink-0" />
                  ) : (
                    <X className="text-destructive size-4 shrink-0" />
                  )}
                  {r.nombre}
                </CardTitle>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {ETIQUETA[r.aisla] ?? r.aisla}
                  </Badge>
                  <span className="text-muted-foreground text-sm tabular-nums">
                    {r.acuerdos}/{r.total}
                  </span>
                </div>
              </CardHeader>
              {!bien && (
                <CardContent className="space-y-1.5 pt-0">
                  {r.desacuerdos.map((d, i) => (
                    <p
                      key={i}
                      className="border-destructive/60 text-muted-foreground border-l-2 py-0.5 pl-3 font-mono text-xs leading-relaxed"
                    >
                      {d}
                    </p>
                  ))}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {datos && (
        <p className="text-muted-foreground mt-6 border-t pt-5 text-xs leading-relaxed">
          Esto mide <strong>acuerdo con las etiquetas</strong> de{" "}
          <code className="bg-muted rounded px-1 py-0.5">scripts/judge-cases.ts</code>, no verdad.
          Si un desacuerdo le parece razonable, lo que hay que discutir es la etiqueta. Y{" "}
          {datos.total} juicios siguen siendo una muestra pequeña: lo que establecen es cuál es el
          modo de falla, no una tasa.
        </p>
      )}

      {!datos && !corriendo && (
        <Card className="border-dashed">
          <CardContent className="text-muted-foreground py-10 text-center text-sm">
            Sin ejecutar todavía.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
