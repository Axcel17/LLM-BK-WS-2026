/**
 * Admite una petición y escribe el resultado como una línea de JSON.
 *
 *     npm run --silent admit -- "100 teclados, 8 días hábiles, tope 5.000"
 *
 * Existe para el panel. El panel no importa código del taller: habla MCP con su
 * servidor, lee sus archivos y ejecuta sus comandos, y esta es la tercera vía.
 * Lo que corre aquí es `admitRequest`, el mismo que usa `npm run agent`, de modo
 * que la consola y la terminal admiten con un solo criterio.
 *
 * Imprime siempre JSON, también cuando no admite: que la petición no alcance no
 * es un fallo del programa, es una de sus tres respuestas.
 */

import { admitRequest } from "../src/admission.js";

const request = process.argv.slice(2).join(" ").trim();

if (request === "") {
  console.log(JSON.stringify({ status: "incomplete", outcome: null, error: "petición vacía" }));
  process.exit(0);
}

try {
  console.log(JSON.stringify(await admitRequest(request)));
} catch (error) {
  // Sin clave, sin red o con el proveedor saturado. El panel necesita poder
  // decirlo en pantalla, así que viaja como dato y no como código de salida.
  console.log(JSON.stringify({ status: "error", error: (error as Error).message.slice(0, 200) }));
}
