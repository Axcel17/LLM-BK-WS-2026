import type { Requisition } from "@/lib/workshop";

/**
 * La requisición vigente, siempre visible sobre la conversación.
 *
 * Responde la pregunta que la consola dejaba sin responder: qué se está
 * comprando y bajo qué restricciones. El agente no la recibe en el chat —la lee
 * con `get_brief`, y lo que sirve esa herramienta es lo que se admitió—, así
 * que tenerla a la vista es lo que hace comprensible el resto.
 */
export function RequisitionPanel({ data, onChange }: { data: Requisition; onChange?: () => void }) {
  const fields = [
    { label: "Cantidad", value: `${data.quantity} unidades` },
    { label: "Plazo máximo", value: `${data.maxLeadTimeBusinessDays} días hábiles` },
    {
      label: "Presupuesto",
      value: `USD ${data.budgetCapUsd.toLocaleString("es")}${data.budgetIncludesFreight ? " con flete" : ""}`,
    },
    { label: "Proveedores", value: `${data.suppliers.length} consultados` },
  ];

  return (
    <section className="border-border/60 bg-card/40 border-b" aria-label="Requisición vigente">
      <div className="mx-auto w-full max-w-4xl px-4 py-3.5">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="text-muted-foreground text-[11px] font-semibold tracking-[0.08em] uppercase">
            Requisición vigente
          </h2>
          <p className="text-sm font-medium">{data.product}</p>
          {onChange !== undefined && (
            <button
              type="button"
              onClick={onChange}
              className="text-muted-foreground hover:text-foreground ml-auto text-xs underline underline-offset-4"
            >
              Cambiar encargo
            </button>
          )}
        </div>

        <dl className="mt-2.5 grid grid-cols-2 gap-x-6 gap-y-1.5 sm:grid-cols-4">
          {fields.map((c) => (
            <div key={c.label}>
              <dt className="text-muted-foreground text-[11px]">{c.label}</dt>
              <dd className="tabular text-sm">{c.value}</dd>
            </div>
          ))}
        </dl>

        <p className="text-muted-foreground border-border/60 mt-3 border-t pt-2.5 text-xs leading-relaxed">
          <span className="text-foreground/70 font-medium">Criterio de adjudicación.</span>{" "}
          {data.selectionCriterion}
        </p>
      </div>
    </section>
  );
}
