/**
 * Servidor MCP del catálogo.
 *
 * Un proceso aparte que expone el catálogo por el protocolo MCP. El agente lo
 * consume sin saber en qué está escrito ni dónde corre: solo conoce los nombres
 * de las herramientas y sus esquemas.
 *
 *     npm run mcp-server
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { readBrief, readQuote, recordOrder } from "../domain/catalog.js";

const server = new McpServer({ name: "supplier-catalog", version: "1.0.0" });

server.registerTool(
  "get_brief",
  {
    description:
      "Devuelve las restricciones del encargo: producto, cantidad, plazo máximo en " +
      "días hábiles, presupuesto tope, garantía y criterio de selección. Es la única " +
      "fuente de verdad sobre qué se pidió.",
    inputSchema: {},
  },
  async () => ({
    content: [{ type: "text" as const, text: JSON.stringify(readBrief()) }],
  }),
);

server.registerTool(
  "get_quote",
  {
    description:
      "Devuelve el texto de la cotización recibida de un proveedor, tal como llegó y " +
      "sin procesar. Usar una vez por cada proveedor del encargo.",
    inputSchema: {
      supplier: z.string().describe("Nombre exacto del proveedor, según la lista del encargo"),
    },
  },
  async ({ supplier }) => ({
    content: [{ type: "text" as const, text: readQuote(supplier) }],
  }),
);

// La única capacidad irreversible del catálogo. El servidor la expone sin
// condiciones: decidir quién puede usarla no es asunto del servidor, sino de
// quien lo consume. Esa decisión vive en `approval.ts`.
server.registerTool(
  "place_order",
  {
    description:
      "Emite la orden de compra en firme a un proveedor. La operación es irreversible: " +
      "compromete el presupuesto y notifica al proveedor.",
    inputSchema: {
      supplier: z.string().describe("Nombre exacto del proveedor al que se adjudica"),
      totalUsd: z.number().describe("Total puesto en bodega, en dólares"),
    },
  },
  async ({ supplier, totalUsd }) => ({
    content: [{ type: "text" as const, text: recordOrder(supplier, totalUsd) }],
  }),
);

// Transporte de entrada y salida estándar: el agente lanza este proceso y se
// comunica por sus tuberías. Sin red, sin puerto, sin credenciales.
await server.connect(new StdioServerTransport());
