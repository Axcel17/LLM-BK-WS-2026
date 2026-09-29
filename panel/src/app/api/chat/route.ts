/**
 * El agente, en modo conversación.
 *
 * `npm run agent` corre el agente con **contrato estricto**: una sola vuelta,
 * salida validada contra `comparisonSchema`, sin conversación. Eso es
 * deliberado y es la mitad de la lección del taller.
 *
 * Esta ruta expone la otra mitad: el mismo modelo, las mismas herramientas MCP
 * y las mismas reglas, pero **sin contrato de salida**, de modo que pueda
 * conversar. Sirve para ver de primera mano lo que cuesta esa libertad — el
 * agente conversacional responde lo que se le pide, y por eso mismo no se
 * puede verificar por código.
 *
 * Las verificaciones y el evaluador viven en la pestaña de evaluación, contra
 * el agente estricto. Aquí no aplican: no hay comparativo que comprobar.
 */

import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from "ai";

import {
  conectarCatalogo,
  configuracion,
  HERRAMIENTAS_IRREVERSIBLES,
  instrucciones,
  MOTIVO_DENEGACION,
} from "@/lib/taller";
import { proveedor } from "@/lib/proveedor";

export const maxDuration = 180;

const AVISO_CONVERSACIONAL = `
Estás respondiendo dentro de un panel de conversación, no produciendo el
comparativo formal. Responde en prosa breve y cita siempre la evidencia de las
cotizaciones que consultes. Si te piden emitir una orden de compra, intenta
hacerlo: la compuerta decidirá, no tú.
`.trim();

export async function POST(request: Request) {
  const { messages }: { messages: UIMessage[] } = await request.json();

  const catalogo = await conectarCatalogo();

  const resultado = streamText({
    model: proveedor("agent"),
    // Las mismas ocho reglas que gobiernan al agente estricto. Lo único que
    // cambia es que aquí no hay contrato de salida.
    system: `${instrucciones()}\n\n${AVISO_CONVERSACIONAL}`,
    messages: await convertToModelMessages(messages),
    tools: catalogo.tools,
    stopWhen: stepCountIs(configuracion().topeDePasos),
    // La misma compuerta del taller: el criterio es la reversibilidad, y la
    // decisión vive en una tabla que se lee antes de ejecutar nada.
    toolApproval: ({ toolCall }) =>
      HERRAMIENTAS_IRREVERSIBLES.includes(toolCall.toolName)
        ? { type: "denied" as const, reason: MOTIVO_DENEGACION }
        : ("not-applicable" as const),
    onFinish: () => {
      // El proceso hijo del servidor MCP queda vivo si no se cierra, y una
      // conversación larga abriría uno por mensaje.
      void catalogo.close();
    },
    onError: () => void catalogo.close(),
  });

  return resultado.toUIMessageStreamResponse({ sendReasoning: true });
}
