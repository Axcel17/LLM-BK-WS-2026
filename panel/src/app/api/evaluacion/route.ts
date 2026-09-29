/**
 * Ejecuta el banco de casos del evaluador.
 *
 * Delega en `npm run measure-judge -- N --json`, que es el mismo comando de la
 * terminal con los mismos cuatro casos etiquetados. Reimplementarlo aquí habría
 * creado un segundo criterio de acuerdo, y dos criterios se desfasan.
 */

import { evaluarEvaluador } from "@/lib/taller";

export const dynamic = "force-dynamic";
export const maxDuration = 600;

export async function POST(request: Request) {
  const { pasadas = 1 }: { pasadas?: number } = await request.json().catch(() => ({}));
  const veces = Math.min(Math.max(Math.trunc(pasadas) || 1, 1), 5);

  try {
    return Response.json(await evaluarEvaluador(veces));
  } catch (error) {
    return Response.json({ error: (error as Error).message.slice(0, 300) }, { status: 500 });
  }
}
