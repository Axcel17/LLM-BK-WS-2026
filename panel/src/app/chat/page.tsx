import { AgentConversation } from "@/components/agent-conversation";
import { RequisitionPanel } from "@/components/requisition-panel";
import { agentCard, requisition } from "@/lib/workshop";

export const dynamic = "force-dynamic";

export default function Chat() {
  // La ficha y la requisición se arman en el servidor desde los mismos
  // archivos que gobiernan al agente: `data/instrucciones.md` y
  // `data/brief.json`. Nada de lo que muestra la consola está escrito aquí.
  return (
    <>
      <RequisitionPanel data={requisition()} />
      <AgentConversation agentCard={agentCard()} />
    </>
  );
}
