/**
 * TODO 2 · La conexión al servidor MCP.
 *
 * Levantan el servidor como proceso hijo y verifican que el dato atraviesa el
 * protocolo. Tardan unos segundos: es el precio de probarlo de verdad y no
 * simularlo.
 *
 *     npm test -- client
 */

import { afterEach, describe, expect, it } from "vitest";

import { connectCatalog, type CatalogConnection } from "../../src/mcp/client.js";

let connection: CatalogConnection | undefined;

afterEach(async () => {
  await connection?.close();
  connection = undefined;
});

describe("connectCatalog", () => {
  it("expone las tres herramientas del servidor", async () => {
    connection = await connectCatalog();
    expect(Object.keys(connection.tools).sort()).toEqual(["get_brief", "get_quote", "place_order"]);
  });

  it("cada herramienta conserva los argumentos que el servidor declara", async () => {
    connection = await connectCatalog();

    // `place_order` declara dos argumentos. Una traducción que reescriba el
    // esquema a mano tiende a quedarse con el primero, y el modelo pierde la
    // capacidad de enviar el segundo sin que nada falle de forma visible.
    const placeOrder = connection.tools["place_order"];
    const schema = JSON.stringify(placeOrder?.inputSchema ?? {});

    expect(schema).toContain("supplier");
    expect(schema).toContain("totalUsd");
  });

  it("una llamada atraviesa el protocolo", async () => {
    connection = await connectCatalog();

    const brief = await connection.getBrief();
    const quote = await connection.getQuote("MayoristaZeta");

    expect(JSON.parse(brief).maxLeadTimeBusinessDays).toBe(10);
    // El precio por caja de diez debe llegar íntegro, sin normalizar.
    expect(quote).toContain("1.590,00");
  });

  it("propaga el error del servidor ante un proveedor inexistente", async () => {
    connection = await connectCatalog();

    const result = await connection.getQuote("NoExiste");
    expect(result).toMatch(/Disponibles|error/i);
  });
});
