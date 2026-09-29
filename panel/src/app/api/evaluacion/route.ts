/**
 * Canaliza la evaluación del evaluador, **mientras corre**.
 *
 * Antes devolvía el total al final. Con cinco pasadas son veinte llamadas a un
 * modelo: minutos de pantalla quieta en los que nadie sabe si trabaja, en qué
 * caso va, ni qué le está preguntando. Una evaluación que no se ve mientras
 * corre pide la misma confianza ciega que este material enseña a no dar.
 *
 * Ejecuta `npm run measure-judge -- N --stream`, que emite una línea JSON por
 * evento, y la reenvía tal cual. El criterio de acuerdo, los casos y el
 * evaluador siguen siendo los del taller: aquí no se decide nada.
 */

import { spawn } from "node:child_process";

import { RAIZ } from "@/lib/taller";

export const dynamic = "force-dynamic";
export const maxDuration = 900;

export async function POST(request: Request) {
  const { pasadas = 1 }: { pasadas?: number } = await request.json().catch(() => ({}));
  const veces = Math.min(Math.max(Math.trunc(pasadas) || 1, 1), 5);

  const proceso = spawn(
    "npm",
    ["run", "--silent", "measure-judge", "--", String(veces), "--stream"],
    { cwd: RAIZ },
  );

  const flujo = new ReadableStream<Uint8Array>({
    start(controlador) {
      let resto = "";

      proceso.stdout.on("data", (trozo: Buffer) => {
        // Una línea puede llegar partida entre dos trozos: se acumula lo que
        // quede sin salto y se emite completo, o el cliente recibe JSON roto.
        resto += trozo.toString("utf8");
        const lineas = resto.split("\n");
        resto = lineas.pop() ?? "";
        for (const linea of lineas) {
          if (linea.trim() !== "") controlador.enqueue(new TextEncoder().encode(`${linea}\n`));
        }
      });

      proceso.stderr.on("data", (trozo: Buffer) => {
        const texto = trozo.toString("utf8").trim();
        if (texto !== "") {
          controlador.enqueue(
            new TextEncoder().encode(
              `${JSON.stringify({ tipo: "aviso", texto: texto.slice(0, 200) })}\n`,
            ),
          );
        }
      });

      proceso.on("close", (codigo) => {
        if (resto.trim() !== "") controlador.enqueue(new TextEncoder().encode(`${resto}\n`));
        if (codigo !== 0) {
          controlador.enqueue(
            new TextEncoder().encode(
              `${JSON.stringify({ tipo: "error", texto: `el proceso terminó con código ${codigo}` })}\n`,
            ),
          );
        }
        controlador.close();
      });

      proceso.on("error", (error) => {
        controlador.enqueue(
          new TextEncoder().encode(
            `${JSON.stringify({ tipo: "error", texto: error.message.slice(0, 200) })}\n`,
          ),
        );
        controlador.close();
      });

      request.signal.addEventListener("abort", () => proceso.kill());
    },
  });

  return new Response(flujo, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" },
  });
}
