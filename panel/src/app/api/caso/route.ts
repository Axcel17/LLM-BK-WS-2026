/**
 * Ejecuta un caso probado y devuelve lo que pasó.
 *
 * Corre `npm run caso -- <id> --json`, que es el mismo comando de la terminal y
 * el mismo que corre en integración continua. El panel no reimplementa ni las
 * afirmaciones ni la respuesta conocida: las pide.
 */

import { runCase } from "@/lib/workshop";

export const maxDuration = 600;

export async function POST(request: Request): Promise<Response> {
  const { id } = (await request.json()) as { id?: string };

  if (typeof id !== "string" || id.trim() === "") {
    return Response.json({ error: "Falta el identificador del caso." }, { status: 400 });
  }

  try {
    return Response.json(await runCase(id.trim()));
  } catch (error) {
    return Response.json({ error: (error as Error).message.slice(0, 300) }, { status: 500 });
  }
}
