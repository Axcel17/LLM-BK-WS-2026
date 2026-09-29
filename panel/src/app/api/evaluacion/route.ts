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

import { REPO_ROOT } from "@/lib/workshop";

export const dynamic = "force-dynamic";
export const maxDuration = 900;

export async function POST(request: Request) {
  const { passes = 1 }: { passes?: number } = await request.json().catch(() => ({}));
  const times = Math.min(Math.max(Math.trunc(passes) || 1, 1), 5);

  const child = spawn(
    "npm",
    ["run", "--silent", "measure-judge", "--", String(times), "--stream"],
    { cwd: REPO_ROOT },
  );

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let buffered = "";

      child.stdout.on("data", (chunk: Buffer) => {
        // Una línea puede llegar partida entre dos trozos: se acumula lo que
        // quede sin salto y se emite completo, o el cliente recibe JSON roto.
        buffered += chunk.toString("utf8");
        const lines = buffered.split("\n");
        buffered = lines.pop() ?? "";
        for (const line of lines) {
          if (line.trim() !== "") controller.enqueue(new TextEncoder().encode(`${line}\n`));
        }
      });

      child.stderr.on("data", (chunk: Buffer) => {
        const text = chunk.toString("utf8").trim();
        if (text !== "") {
          controller.enqueue(
            new TextEncoder().encode(
              `${JSON.stringify({ tipo: "aviso", texto: text.slice(0, 200) })}\n`,
            ),
          );
        }
      });

      child.on("close", (code) => {
        if (buffered.trim() !== "") controller.enqueue(new TextEncoder().encode(`${buffered}\n`));
        if (code !== 0) {
          controller.enqueue(
            new TextEncoder().encode(
              `${JSON.stringify({ tipo: "error", texto: `el child terminó con código ${code}` })}\n`,
            ),
          );
        }
        controller.close();
      });

      child.on("error", (error) => {
        controller.enqueue(
          new TextEncoder().encode(
            `${JSON.stringify({ tipo: "error", texto: error.message.slice(0, 200) })}\n`,
          ),
        );
        controller.close();
      });

      request.signal.addEventListener("abort", () => child.kill());
    },
  });

  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" },
  });
}
