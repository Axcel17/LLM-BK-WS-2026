/**
 * La puerta de entrada de la consola.
 *
 * Convierte una petición en prosa en la requisición que gobierna la
 * conversación, o dice qué falta. Corre antes de abrir el chat: escalar aquí
 * cuesta una llamada, y escalar después de consultar a cinco proveedores
 * cuesta seis.
 */

import { admit } from "@/lib/workshop";

export const maxDuration = 120;

export async function POST(request: Request): Promise<Response> {
  const { peticion } = (await request.json()) as { peticion?: string };

  if (typeof peticion !== "string" || peticion.trim() === "") {
    return Response.json({ status: "error", error: "No hay petición que admitir." });
  }

  return Response.json(await admit(peticion.trim()));
}
