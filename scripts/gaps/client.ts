/**
 * Conexión al servidor MCP.
 *
 * El agente consume el catálogo a través de un servidor MCP: un proceso aparte
 * que habla un protocolo. No importa en qué lenguaje esté escrito ni dónde
 * corra mientras respete el contrato.
 *
 * Exponerlo por HTTP cambiaría solo el transporte; el resto del archivo queda
 * igual. Ese es el valor de que haya un protocolo de por medio.
 *
 * HUECO 2 · Complete la traducción de las definiciones del servidor.
 * `npm test -- tools` es la condición de parada.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { jsonSchema, tool, type ToolSet } from "ai";

/** Conexión viva a un servidor MCP, con sus herramientas ya traducidas. */
export interface CatalogConnection {
  /** Registro que consume el agente. */
  readonly tools: ToolSet;
  /** Acceso tipado a las mismas capacidades, para uso directo y pruebas. */
  getBrief(): Promise<string>;
  getQuote(supplier: string): Promise<string>;
  close(): Promise<void>;
}

function textOf(result: unknown): string {
  const content = (result as { content?: Array<{ type: string; text?: string }> }).content ?? [];
  return content
    .filter((part) => part.type === "text")
    .map((part) => part.text ?? "")
    .join("\n");
}

/**
 * Levanta el servidor como proceso hijo y expone sus herramientas al agente.
 *
 * Las definiciones que devuelve el servidor se traducen a herramientas del
 * arnés: el esquema declarado del lado MCP se vuelve el esquema que el modelo
 * ve, sin duplicarlo a mano.
 */
export async function connectCatalog(): Promise<CatalogConnection> {
  const client = new Client({ name: "quote-comparison-agent", version: "1.0.0" });

  await client.connect(
    new StdioClientTransport({
      command: "npx",
      args: ["tsx", "src/mcp/server.ts"],
    }),
  );

  const { tools: available } = await client.listTools();

  const tools: ToolSet = {};

  // <<< HUECO 2 · TRADUCIR LAS DEFINICIONES DEL SERVIDOR >>>
  //
  // `available` trae lo que el servidor declara: nombre, descripción y esquema
  // de entrada. Recórralo y, por cada definición, registre una herramienta:
  //
  //     tools[definition.name] = tool({ description, inputSchema, execute });
  //
  //   · description  lo único que el modelo lee para decidir si la usa
  //   · inputSchema  la forma de los argumentos que el modelo puede enviar
  //   · execute      invoca `client.callTool({ name, arguments })` y devuelve
  //                  `textOf(...)` del resultado
  //
  // Sobre el esquema de entrada hay una decisión que tomar, y una de las
  // pruebas la discrimina: el servidor ya declara el suyo en
  // `definition.inputSchema`. Se puede reescribir aquí a mano, o usar el que
  // llega. Mire qué herramientas expone el catálogo antes de decidir.
  //
  // Esta tabla es el límite del agente: una herramienta ausente de este
  // registro no existe para el modelo, aunque su nombre aparezca en el prompt.

  // El acceso tipado viene resuelto. Alcanza las mismas capacidades por el
  // mismo cliente, pero con firma conocida: las pruebas y el código propio no
  // deberían depender de la forma interna del registro para invocar una.
  const call = async (name: string, args: Record<string, unknown>): Promise<string> =>
    textOf(await client.callTool({ name, arguments: args }));

  return {
    tools,
    getBrief: () => call("get_brief", {}),
    getQuote: (supplier) => call("get_quote", { supplier }),
    close: () => client.close(),
  };
}
