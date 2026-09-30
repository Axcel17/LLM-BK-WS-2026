"use client";

import { ArrowRight, CircleAlert, Loader2 } from "lucide-react";
import { useState } from "react";

import { AgentConversation, type AgentCard } from "@/components/agent-conversation";
import { RequisitionPanel } from "@/components/requisition-panel";
import { Button } from "@/components/ui/button";
import type { Admission, Requisition } from "@/lib/workshop";

/**
 * La puerta: primero se admite el encargo, después se conversa.
 *
 * El mismo orden que la terminal, y por el mismo motivo. `get_brief` sirve lo
 * que se admitió aquí, así que sin este paso el agente conversaría sobre el
 * encargo del archivo mientras se le pregunta por otro producto.
 *
 * Lo que se declara de menos no se supone: la admisión enumera qué falta y
 * devuelve la pregunta, sin haber consultado a ningún proveedor.
 */
export function AdmissionGate({
  agentCard,
  fallback,
}: {
  agentCard: AgentCard;
  fallback: Requisition;
}) {
  const [encargo, setEncargo] = useState<Requisition | null>(null);
  const [draft, setDraft] = useState("");
  const [result, setResult] = useState<Admission | null>(null);
  const [busy, setBusy] = useState(false);

  async function admit(text: string) {
    const trimmed = text.trim();
    if (trimmed === "" || busy) return;

    setBusy(true);
    setResult(null);
    try {
      const response = await fetch("/api/admision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ peticion: trimmed }),
      });
      const admission = (await response.json()) as Admission;
      setResult(admission);
      if (admission.status === "admitted") setEncargo(admission.brief);
    } catch (error) {
      setResult({ status: "error", error: (error as Error).message });
    } finally {
      setBusy(false);
    }
  }

  if (encargo !== null) {
    return (
      <>
        <RequisitionPanel data={encargo} onChange={() => setEncargo(null)} />
        <AgentConversation agentCard={agentCard} encargo={encargo} />
      </>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      <h2 className="text-muted-foreground text-[11px] font-semibold tracking-[0.08em] uppercase">
        Admisión
      </h2>
      <p className="mt-2 text-sm leading-relaxed">
        Declare qué necesita comprar. Hacen falta{" "}
        <strong>producto, cantidad, plazo en días hábiles y presupuesto tope</strong>: sin los
        cuatro no hay ronda que consultar, y se pregunta antes de gastar una sola consulta.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void admit(draft);
        }}
        className="border-border/70 bg-card focus-within:border-primary/50 focus-within:ring-primary/10 mt-5 flex items-end gap-2 rounded-2xl border p-2 shadow-sm transition-all focus-within:ring-4"
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void admit(draft);
            }
          }}
          rows={2}
          placeholder="Necesito 100 teclados inalámbricos en 8 días hábiles, con tope de 5.000 dólares"
          aria-label="Petición"
          className="max-h-40 min-h-14 flex-1 resize-none bg-transparent px-2.5 py-1.5 text-sm outline-none"
          disabled={busy}
        />
        <Button
          type="submit"
          size="icon"
          aria-label="Admitir"
          disabled={busy || draft.trim() === ""}
          className="size-9 shrink-0 rounded-xl"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
        </Button>
      </form>

      <button
        type="button"
        onClick={() => setEncargo(fallback)}
        className="text-muted-foreground hover:text-foreground mt-3 text-xs underline underline-offset-4"
      >
        O usar el encargo del caso validado: {fallback.product}, {fallback.quantity} unidades
      </button>

      {result !== null && result.status !== "admitted" && (
        <div className="border-border/60 bg-card/40 mt-6 rounded-xl border px-4 py-3.5 text-sm">
          <p className="flex items-center gap-2 font-medium">
            <CircleAlert className="text-muted-foreground size-4 shrink-0" aria-hidden />
            {result.status === "incomplete"
              ? "La petición no alcanza para trabajar"
              : result.status === "unfounded"
                ? "La extracción no se sostiene"
                : "La admisión no pudo completarse"}
          </p>

          {result.status === "incomplete" && (
            <>
              <ul className="text-muted-foreground mt-2.5 space-y-1 text-xs leading-relaxed">
                {result.outcome.missing.map((m) => (
                  <li key={m.field}>
                    <span className="text-foreground/70 font-mono">{m.field}</span> — {m.why}
                  </li>
                ))}
              </ul>
              {result.outcome.question !== null && (
                <p className="border-border/60 mt-3 border-t pt-2.5 text-xs leading-relaxed">
                  {result.outcome.question}
                </p>
              )}
            </>
          )}

          {result.status === "unfounded" && (
            <ul className="text-muted-foreground mt-2.5 space-y-1 text-xs leading-relaxed">
              {result.findings.map((f) => (
                <li key={f.detail}>{f.detail}</li>
              ))}
            </ul>
          )}

          {result.status === "error" && (
            <p className="text-muted-foreground mt-2 text-xs break-words">{result.error}</p>
          )}

          <p className="text-muted-foreground border-border/60 mt-3 border-t pt-2.5 text-[11px]">
            No se consultó a ningún proveedor.
          </p>
        </div>
      )}
    </div>
  );
}
