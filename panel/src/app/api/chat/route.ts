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

import { conectarCatalogo, configuracion, instrucciones, MOTIVO_APROBACION } from "@/lib/taller";
import { proveedor } from "@/lib/proveedor";

export const maxDuration = 180;

/**
 * Lo que cambia respecto de la terminal, y por qué.
 *
 * La regla 8 dice «no adjudicas», y en la terminal es absoluta porque no hay
 * nadie mirando. Aquí sí hay alguien: la compuerta se detiene y pregunta. Por
 * eso la regla se matiza —no que el agente decida, sino que **proponga** la
 * acción para que una persona la firme—, que es exactamente lo que significa
 * poner la compuerta entre la última acción reversible y la primera que no lo es.
 */
const AVISO_CONVERSACIONAL = `
Estás en un panel donde hay una persona al otro lado, no produciendo el
comparativo formal.

CÓMO RESPONDER

Actúa primero. Si para contestar hace falta consultar algo, consúltalo — no
pidas permiso ni anuncies lo que vas a hacer. Nunca preguntes «¿deseas que
comience?»: si te preguntaron, comienza.

Sé breve. Entre dos y cuatro frases después de haber hecho el trabajo, o una
tabla si comparas. La persona ve en pantalla cada herramienta que invocaste y
lo que devolvió, así que no narres el proceso ni repitas los datos que ya están
a la vista.

Empieza por la respuesta. Nada de «he finalizado el análisis», «procederé a» ni
«aquí tienes»: la primera línea ya es el resultado.

No expliques tus reglas salvo que te las pregunten. Da la respuesta y la cifra
que la sostiene.

Si la pregunta supone un análisis que todavía no hiciste, hazlo y responde — no
expliques por qué no puedes responder aún.

SOBRE LA REGLA 8

Aquí se aplica así: sigues sin adjudicar por tu cuenta, pero cuando te pidan
emitir una orden invoca place_order igualmente. No la ejecutarás tú: la llamada
se detiene en una compuerta y la aprueba o la rechaza la persona. Negarte a
invocarla le quita esa decisión a quien le corresponde.
`.trim();

/** El consumo que el panel muestra en su barra de métricas. */
export type MetadatosMensaje = {
  entrada: number;
  salida: number;
  cache: number;
};

export async function POST(request: Request) {
  const {
    messages,
    requierenFirma = ["place_order"],
  }: { messages: UIMessage[]; requierenFirma?: string[] } = await request.json();

  const catalogo = await conectarCatalogo();

  const resultado = streamText({
    model: proveedor("agent"),
    // Las mismas ocho reglas que gobiernan al agente estricto. Lo único que
    // cambia es que aquí no hay contrato de salida.
    system: `${instrucciones()}\n\n${AVISO_CONVERSACIONAL}`,
    messages: await convertToModelMessages(messages),
    tools: catalogo.tools,
    stopWhen: stepCountIs(configuracion().topeDePasos),
    // La compuerta, con dos diferencias respecto de la terminal.
    //
    // `npm run agent` deniega en firme, porque no hay nadie mirando: la única
    // respuesta segura es no. Aquí hay alguien, así que la compuerta hace lo
    // que debe hacer cuando existe un humano — **se detiene y pregunta**.
    //
    // Y la tabla la fija quien usa el panel, no este archivo. Es la decisión
    // del paso 1 de la Parte 1 —permisos por acción, antes de conectar nada—
    // puesta donde se puede cambiar y ver el efecto en la misma pantalla.
    toolApproval: ({ toolCall }) =>
      requierenFirma.includes(toolCall.toolName)
        ? { type: "user-approval" as const, reason: MOTIVO_APROBACION }
        : ("not-applicable" as const),
    onFinish: () => {
      // El proceso hijo del servidor MCP queda vivo si no se cierra, y una
      // conversación larga abriría uno por mensaje.
      void catalogo.close();
    },
    onError: () => void catalogo.close(),
  });

  return resultado.toUIMessageStreamResponse({
    sendReasoning: true,
    // El consumo viaja con el mensaje. Sin esto la barra de métricas tendría
    // que estimarlo, y un número estimado que parece medido es peor que no
    // mostrar ninguno.
    messageMetadata: ({ part }): MetadatosMensaje | undefined => {
      if (part.type !== "finish") return undefined;
      const uso = part.totalUsage as
        | {
            inputTokens?: number;
            outputTokens?: number;
            inputTokenDetails?: { cacheReadTokens?: number };
          }
        | undefined;
      return {
        entrada: uso?.inputTokens ?? 0,
        salida: uso?.outputTokens ?? 0,
        cache: uso?.inputTokenDetails?.cacheReadTokens ?? 0,
      };
    },
  });
}
