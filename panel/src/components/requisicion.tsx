import type { Requisicion } from "@/lib/taller";

/**
 * La requisición vigente, siempre visible sobre la conversación.
 *
 * Responde la pregunta que la consola dejaba sin responder: qué se está
 * comprando y bajo qué restricciones. El agente no la recibe de quien consulta
 * —la lee del sistema con `get_brief`—, y mostrarla evita que la conversación
 * parezca pedir datos que ya existen.
 */
export function PanelRequisicion({ datos }: { datos: Requisicion }) {
  const campos = [
    { etiqueta: "Cantidad", valor: `${datos.quantity} unidades` },
    { etiqueta: "Plazo máximo", valor: `${datos.maxLeadTimeBusinessDays} días hábiles` },
    {
      etiqueta: "Presupuesto",
      valor: `USD ${datos.budgetCapUsd.toLocaleString("es")}${datos.budgetIncludesFreight ? " con flete" : ""}`,
    },
    { etiqueta: "Proveedores", valor: `${datos.suppliers.length} consultados` },
  ];

  return (
    <section className="border-border/60 bg-card/40 border-b" aria-label="Requisición vigente">
      <div className="mx-auto w-full max-w-4xl px-4 py-3.5">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="text-muted-foreground text-[11px] font-semibold tracking-[0.08em] uppercase">
            Requisición vigente
          </h2>
          <p className="text-sm font-medium">{datos.product}</p>
        </div>

        <dl className="mt-2.5 grid grid-cols-2 gap-x-6 gap-y-1.5 sm:grid-cols-4">
          {campos.map((c) => (
            <div key={c.etiqueta}>
              <dt className="text-muted-foreground text-[11px]">{c.etiqueta}</dt>
              <dd className="tabular text-sm">{c.valor}</dd>
            </div>
          ))}
        </dl>

        <p className="text-muted-foreground border-border/60 mt-3 border-t pt-2.5 text-xs leading-relaxed">
          <span className="text-foreground/70 font-medium">Criterio de adjudicación.</span>{" "}
          {datos.selectionCriterion}
        </p>
      </div>
    </section>
  );
}
