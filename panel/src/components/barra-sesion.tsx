"use client";

import { Lock, Unlock } from "lucide-react";

import { cn } from "@/lib/utils";

export type Herramienta = { nombre: string; descripcion: string };

type Props = {
  herramientas: Herramienta[];
  requierenFirma: string[];
  onCambiarFirma: (nombre: string) => void;
  bloqueado: boolean;
  entrada: number;
  salida: number;
  cache: number;
  pasos: number;
  topeDePasos: number;
  modelo: string;
};

const mil = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

function Metrica({ valor, etiqueta, ayuda }: { valor: string; etiqueta: string; ayuda: string }) {
  return (
    <div title={ayuda}>
      <dt className="text-muted-foreground text-[11px]">{etiqueta}</dt>
      <dd className="tabular text-sm">{valor}</dd>
    </div>
  );
}

/**
 * Estado de la sesión y política de autorización.
 *
 * Va sobre la conversación, no en una columna lateral: lo necesario para
 * interpretar la conversación pertenece al mismo campo visual.
 */
export function BarraSesion({
  herramientas,
  requierenFirma,
  onCambiarFirma,
  bloqueado,
  entrada,
  salida,
  cache,
  pasos,
  topeDePasos,
  modelo,
}: Props) {
  const pctCache = entrada > 0 ? Math.round((cache / entrada) * 100) : 0;
  const pctPasos = Math.min(100, Math.round((pasos / topeDePasos) * 100));

  return (
    <section className="border-border/60 bg-card/60 border-b backdrop-blur" aria-label="Sesión">
      <div className="mx-auto w-full max-w-4xl px-4 py-3">
        <dl className="flex flex-wrap items-start gap-x-7 gap-y-2">
          <Metrica valor={modelo} etiqueta="Modelo" ayuda="Modelo que atiende la sesión." />

          <div
            title={`El agente consume un paso cada vez que invoca una herramienta. El límite de ${topeDePasos} detiene la ejecución: es un control de costo, no una estimación de cuántos necesita.`}
          >
            <dt className="text-muted-foreground text-[11px]">Pasos · límite {topeDePasos}</dt>
            <dd className="flex items-center gap-2">
              <span className="tabular text-sm">{pasos}</span>
              <span className="bg-muted h-1 w-12 overflow-hidden rounded-full">
                <span
                  className={cn(
                    "block h-full rounded-full",
                    pctPasos > 80 ? "bg-firma" : "bg-primary",
                  )}
                  style={{ width: `${pctPasos}%` }}
                />
              </span>
            </dd>
          </div>

          <Metrica
            valor={mil(entrada)}
            etiqueta="Tokens de entrada"
            ayuda="Crece en cada paso: el ciclo reenvía la conversación completa junto con las definiciones de herramientas."
          />
          <Metrica valor={mil(salida)} etiqueta="Tokens de salida" ayuda="Tokens generados." />
          <Metrica
            valor={`${pctCache} %`}
            etiqueta="Servido de caché"
            ayuda="Proporción de la entrada que el proveedor no volvió a facturar. Depende del proveedor."
          />
        </dl>
      </div>

      <div className="border-border/40 bg-muted/25 border-t">
        <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2">
          <span className="text-muted-foreground text-[11px] font-semibold tracking-[0.08em] uppercase">
            Autorización
          </span>

          {herramientas.map((h) => {
            const restringida = requierenFirma.includes(h.nombre);
            return (
              <button
                key={h.nombre}
                type="button"
                onClick={() => onCambiarFirma(h.nombre)}
                disabled={bloqueado}
                aria-pressed={restringida}
                title={
                  `${h.descripcion}\n\n` +
                  (restringida
                    ? "Requiere autorización previa. Seleccione para permitir su ejecución automática."
                    : "Se ejecuta de forma automática. Seleccione para exigir autorización previa.") +
                  (bloqueado ? "\n\nNo se puede modificar durante una ejecución." : "")
                }
                className={cn(
                  "flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-mono text-[11px] transition-colors disabled:opacity-50",
                  restringida
                    ? "border-firma/50 bg-firma-suave text-firma"
                    : "border-border/70 text-foreground/75 hover:border-foreground/30",
                )}
              >
                {restringida ? (
                  <Lock className="size-3 shrink-0" aria-hidden />
                ) : (
                  <Unlock className="size-3 shrink-0 opacity-40" aria-hidden />
                )}
                {h.nombre}
              </button>
            );
          })}

          <span className="text-muted-foreground ml-auto text-[11px]">
            {requierenFirma.length === 0
              ? "Ninguna acción requiere autorización"
              : `${requierenFirma.length} ${requierenFirma.length === 1 ? "acción requiere" : "acciones requieren"} autorización previa`}
          </span>
        </div>
      </div>
    </section>
  );
}
