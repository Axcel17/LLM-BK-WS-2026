/**
 * Las bitácoras que deja `npm run agent`, para la sección de monitoreo.
 *
 * El panel las lee; no las produce. Esa separación es deliberada: si el panel
 * fuera la única forma de generar datos, el monitoreo mediría al panel y no al
 * agente.
 */

import { leerCorridas } from "@/lib/taller";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ corridas: leerCorridas() });
}
