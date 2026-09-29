import { Conversacion } from "@/components/conversacion";
import { PanelRequisicion } from "@/components/requisicion";
import { ficha, requisicion } from "@/lib/taller";

export const dynamic = "force-dynamic";

export default function Chat() {
  // La ficha y la requisición se arman en el servidor desde los mismos
  // archivos que gobiernan al agente: `data/instrucciones.md` y
  // `data/brief.json`. Nada de lo que muestra la consola está escrito aquí.
  return (
    <>
      <PanelRequisicion datos={requisicion()} />
      <Conversacion ficha={ficha()} />
    </>
  );
}
