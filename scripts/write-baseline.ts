/**
 * Registra la huella del catálogo de herramientas.
 *
 * Se corre una vez, cuando el catálogo está como debe estar. A partir de ahí,
 * cada corrida del agente compara contra esta referencia y avisa si algo
 * cambió.
 *
 *     npm run baseline
 */

import { writeBaseline } from "../src/mcp/integrity.js";
import { connectCatalog } from "../src/mcp/client.js";

const catalog = await connectCatalog();
try {
  await writeBaseline(catalog.tools);
  console.log(`Huella registrada: ${Object.keys(catalog.tools).sort().join(", ")}`);
} finally {
  await catalog.close();
}
