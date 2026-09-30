import { AdmissionGate } from "@/components/admission-gate";
import { agentCard, products, requisition } from "@/lib/workshop";

export const dynamic = "force-dynamic";

export default function Chat() {
  // Todo sale de los archivos que gobiernan al agente: las reglas de
  // `data/instrucciones.md`, los productos de `data/catalogo.json` y la
  // requisición del caso de `data/brief.json`. Nada escrito aquí.
  return <AdmissionGate agentCard={agentCard()} fallback={requisition()} products={products()} />;
}
