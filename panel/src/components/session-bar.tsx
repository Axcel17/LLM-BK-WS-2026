"use client";

import { Lock, Unlock } from "lucide-react";

import { cn } from "@/lib/utils";

export type AgentTool = { name: string; description: string };

type Props = {
  tools: AgentTool[];
  needsApproval: string[];
  onToggleApproval: (name: string) => void;
  locked: boolean;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  steps: number;
  stepLimit: number;
  model: string;
};

const short = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

function Metric({ value, label, hint }: { value: string; label: string; hint: string }) {
  return (
    <div title={hint}>
      <dt className="text-muted-foreground text-[11px]">{label}</dt>
      <dd className="tabular text-sm">{value}</dd>
    </div>
  );
}

/**
 * Estado de la sesión y política de autorización.
 *
 * Va sobre la conversación, no en una columna lateral: lo necesario para
 * interpretar la conversación pertenece al mismo campo visual.
 */
export function SessionBar({
  tools,
  needsApproval,
  onToggleApproval,
  locked,
  inputTokens,
  outputTokens,
  cachedTokens,
  steps,
  stepLimit,
  model,
}: Props) {
  const cachePct = inputTokens > 0 ? Math.round((cachedTokens / inputTokens) * 100) : 0;
  const stepsPct = Math.min(100, Math.round((steps / stepLimit) * 100));

  return (
    <section className="border-border/60 bg-card/60 border-b backdrop-blur" aria-label="Sesión">
      <div className="mx-auto w-full max-w-4xl px-4 py-3">
        <dl className="flex flex-wrap items-start gap-x-7 gap-y-2">
          <Metric value={model} label="Modelo" hint="Modelo que atiende la sesión." />

          <div
            title={`El agente consume un paso cada vez que invoca una herramienta. El límite de ${stepLimit} detiene la ejecución: es un control de costo, no una estimación de cuántos necesita.`}
          >
            <dt className="text-muted-foreground text-[11px]">Pasos · límite {stepLimit}</dt>
            <dd className="flex items-center gap-2">
              <span className="tabular text-sm">{steps}</span>
              <span className="bg-muted h-1 w-12 overflow-hidden rounded-full">
                <span
                  className={cn(
                    "block h-full rounded-full",
                    stepsPct > 80 ? "bg-firma" : "bg-primary",
                  )}
                  style={{ width: `${stepsPct}%` }}
                />
              </span>
            </dd>
          </div>

          <Metric
            value={short(inputTokens)}
            label="Tokens de entrada"
            hint="Crece en cada paso: el ciclo reenvía la conversación completa junto con las definiciones de herramientas."
          />
          <Metric value={short(outputTokens)} label="Tokens de salida" hint="Tokens generados." />
          <Metric
            value={`${cachePct} %`}
            label="Servido de caché"
            hint="Proporción de la entrada que el proveedor no volvió a facturar. Depende del proveedor."
          />
        </dl>
      </div>

      <div className="border-border/40 bg-muted/25 border-t">
        <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2">
          <span className="text-muted-foreground text-[11px] font-semibold tracking-[0.08em] uppercase">
            Autorización
          </span>

          {tools.map((h) => {
            const restricted = needsApproval.includes(h.name);
            return (
              <button
                key={h.name}
                type="button"
                onClick={() => onToggleApproval(h.name)}
                disabled={locked}
                aria-pressed={restricted}
                title={
                  `${h.description}\n\n` +
                  (restricted
                    ? "Requiere autorización previa. Seleccione para permitir su ejecución automática."
                    : "Se ejecuta de forma automática. Seleccione para exigir autorización previa.") +
                  (locked ? "\n\nNo se puede modificar durante una ejecución." : "")
                }
                className={cn(
                  "flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-mono text-[11px] transition-colors disabled:opacity-50",
                  restricted
                    ? "border-firma/50 bg-firma-suave text-firma"
                    : "border-border/70 text-foreground/75 hover:border-foreground/30",
                )}
              >
                {restricted ? (
                  <Lock className="size-3 shrink-0" aria-hidden />
                ) : (
                  <Unlock className="size-3 shrink-0 opacity-40" aria-hidden />
                )}
                {h.name}
              </button>
            );
          })}

          <span className="text-muted-foreground ml-auto text-[11px]">
            {needsApproval.length === 0
              ? "Ninguna acción requiere autorización"
              : `${needsApproval.length} ${needsApproval.length === 1 ? "acción requiere" : "acciones requieren"} autorización previa`}
          </span>
        </div>
      </div>
    </section>
  );
}
