import { AdmissionGate } from "@/components/admission-gate";
import { agentCard, requisition } from "@/lib/workshop";

export const dynamic = "force-dynamic";

export default function Chat() {
  // La ficha sale de `data/instrucciones.md`, el mismo archivo que gobierna al
  // agente. La requisición del caso viaja como alternativa, no como encargo
  // impuesto: aquí se declara el propio y la admisión decide si alcanza.
  return <AdmissionGate agentCard={agentCard()} fallback={requisition()} />;
}
