/**
 * Conexión al servidor MCP.
 *
 * El agente consume el catálogo a través de un servidor MCP: un proceso aparte
 * que habla un protocolo. No importa en qué lenguaje esté escrito ni dónde
 * corra mientras respete el contrato.
 *
 * Exponerlo por HTTP cambiaría solo el transporte; el resto del archivo queda
 * igual. Ese es el valor de que haya un protocolo de por medio.
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

  for (const definition of available) {
    tools[definition.name] = tool({
      description: definition.description ?? "",
      // El esquema que el servidor declara se usa tal cual. Reescribirlo a mano
      // aquí duplicaría el contrato en dos lugares, y el día que el servidor
      // agregue un argumento esta copia se quedaría atrás sin avisar.
      inputSchema: jsonSchema(definition.inputSchema as Parameters<typeof jsonSchema>[0]),
      execute: async (args) =>
        textOf(
          await client.callTool({
            name: definition.name,
            arguments: args as Record<string, unknown>,
          }),
        ),
    });
  }

  const call = async (name: string, args: Record<string, unknown>): Promise<string> =>
    textOf(await client.callTool({ name, arguments: args }));

  return {
    tools,
    getBrief: () => call("get_brief", {}),
    getQuote: (supplier) => call("get_quote", { supplier }),
    close: () => client.close(),
  };
}
