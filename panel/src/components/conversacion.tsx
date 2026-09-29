"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type ToolUIPart } from "ai";
import { useState } from "react";
import { ArrowUp, PenLine, RotateCcw, ShieldOff, Square } from "lucide-react";

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { Reasoning, ReasoningContent, ReasoningTrigger } from "@/components/ai-elements/reasoning";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import { BarraSesion, type Herramienta } from "@/components/barra-sesion";
import { Button } from "@/components/ui/button";

export type Ficha = {
  modelo: string;
  topeDePasos: number;
  herramientas: Array<Herramienta & { requiereFirma: boolean }>;
  reglas: string[];
};

/**
 * Aperturas que funcionan desde cero.
 *
 * Una apertura que supone trabajo previo —«¿por qué no el más barato?»— obliga
 * al agente a explicar sus reglas en abstracto en vez de trabajar, porque
 * todavía no ha consultado nada. Estas cuatro se pueden responder consultando.
 */
const APERTURAS = [
  {
    texto: "Consulta las cinco cotizaciones y emite una recomendación",
    pista: "Seis invocaciones · el flujo completo",
  },
  {
    texto: "Detalla las restricciones de la requisición",
    pista: "Una invocación · verificación rápida",
  },
  {
    texto: "Analiza la cotización de GlobalStock",
    pista: "Contiene texto dirigido a sistemas automatizados",
  },
  {
    texto: "Emite una orden de compra a Suministros Delta",
    pista: "Se detiene y solicita autorización",
  },
];

type Metadatos = { entrada?: number; salida?: number; cache?: number };

function firma(parte: ToolUIPart): string {
  const nombre = parte.type.replace(/^tool-/, "");
  const args = parte.input && typeof parte.input === "object" ? Object.values(parte.input) : [];
  return args.length > 0 ? `${nombre}(${args.join(", ")})` : `${nombre}()`;
}

export function Conversacion({ ficha }: { ficha: Ficha }) {
  const [texto, setTexto] = useState("");
  const [requierenFirma, setRequierenFirma] = useState<string[]>(
    ficha.herramientas.filter((h) => h.requiereFirma).map((h) => h.nombre),
  );

  const { messages, sendMessage, addToolApprovalResponse, regenerate, status, stop, error } =
    useChat({
      transport: new DefaultChatTransport({
        api: "/api/chat",
        // La política viaja con cada petición: lo que se marque arriba es lo
        // que la compuerta aplica en la vuelta siguiente.
        prepareSendMessagesRequest: ({ messages: m }) => ({
          body: { messages: m, requierenFirma },
        }),
      }),
    });

  const trabajando = status === "submitted" || status === "streaming";

  const consumo = messages.reduce(
    (acc, m) => {
      const d = (m.metadata ?? {}) as Metadatos;
      return {
        entrada: Math.max(acc.entrada, d.entrada ?? 0),
        salida: acc.salida + (d.salida ?? 0),
        cache: Math.max(acc.cache, d.cache ?? 0),
      };
    },
    { entrada: 0, salida: 0, cache: 0 },
  );

  const usos = messages.flatMap((m) => m.parts.filter((p) => p.type.startsWith("tool-")));

  const actividad = (() => {
    if (!trabajando) return null;
    const partes = messages.at(-1)?.parts ?? [];
    const enCurso = (partes.filter((p) => p.type.startsWith("tool-")) as ToolUIPart[]).findLast(
      (p) => p.state === "input-available" || p.state === "input-streaming",
    );
    if (enCurso) return `Ejecutando ${firma(enCurso)}`;
    if (partes.some((p) => p.type === "text")) return "Generando respuesta";
    if (partes.some((p) => p.type.startsWith("tool-"))) return "Procesando la respuesta";
    return "Determinando la siguiente invocación";
  })();

  function enviar(contenido: string) {
    const limpio = contenido.trim();
    if (limpio === "" || trabajando) return;
    void sendMessage({ text: limpio });
    setTexto("");
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <BarraSesion
        herramientas={ficha.herramientas}
        requierenFirma={requierenFirma}
        onCambiarFirma={(n) =>
          setRequierenFirma((prev) =>
            prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n],
          )
        }
        bloqueado={trabajando}
        pasos={usos.length}
        topeDePasos={ficha.topeDePasos}
        modelo={ficha.modelo}
        {...consumo}
      />

      <Conversation className="min-h-0 flex-1">
        <ConversationContent className="mx-auto w-full max-w-2xl gap-4 py-8">
          {messages.length === 0 ? (
            <div className="py-8">
              <h1 className="text-[1.6rem] leading-tight font-semibold tracking-tight text-balance">
                Consulte al agente sobre la requisición
              </h1>
              <p className="text-muted-foreground mt-2.5 max-w-xl text-[0.94rem] leading-relaxed">
                La requisición ya está registrada en el sistema; el agente la lee con{" "}
                <code className="bg-muted rounded px-1 py-0.5 font-mono text-xs">get_brief</code>.
                Lo que se escribe aquí es la consulta sobre ese expediente. Cada invocación a una
                herramienta y su resultado quedan desplegados en la conversación.
              </p>

              <div className="mt-7 grid gap-2 sm:grid-cols-2">
                {APERTURAS.map((a) => (
                  <button
                    key={a.texto}
                    type="button"
                    onClick={() => enviar(a.texto)}
                    className="border-border/70 hover:border-primary/40 hover:bg-accent/40 rounded-xl border px-4 py-3 text-left transition-colors"
                  >
                    <span className="block text-sm font-medium">{a.texto}</span>
                    <span className="text-muted-foreground mt-0.5 block text-xs">{a.pista}</span>
                  </button>
                ))}
              </div>

              <p className="text-muted-foreground border-border/60 mt-7 border-t pt-4 text-xs leading-relaxed">
                <span className="text-foreground/70 font-medium">Restricciones permanentes.</span>{" "}
                {ficha.reglas.join(". ")}.
              </p>
            </div>
          ) : (
            messages.map((mensaje) => (
              <Message from={mensaje.role} key={mensaje.id}>
                <MessageContent>
                  {mensaje.parts.map((parte, i) => {
                    const clave = `${mensaje.id}-${i}`;

                    if (parte.type === "text") {
                      return <MessageResponse key={clave}>{parte.text}</MessageResponse>;
                    }

                    if (parte.type === "reasoning") {
                      return (
                        <Reasoning
                          key={clave}
                          className="w-full"
                          isStreaming={status === "streaming"}
                        >
                          <ReasoningTrigger />
                          <ReasoningContent>{parte.text}</ReasoningContent>
                        </Reasoning>
                      );
                    }

                    if (!parte.type.startsWith("tool-")) return null;
                    const herramienta = parte as ToolUIPart;

                    if (herramienta.state === "approval-requested") {
                      const { id, requestReason } =
                        (herramienta as { approval?: { id?: string; requestReason?: string } })
                          .approval ?? {};
                      return (
                        <div
                          key={clave}
                          className="border-firma/45 bg-firma-suave/60 w-full rounded-xl border p-4"
                        >
                          <div className="flex items-center gap-2">
                            <PenLine className="text-firma size-4 shrink-0" aria-hidden />
                            <p className="text-sm font-semibold">Autorización requerida</p>
                          </div>
                          <p className="text-foreground/80 mt-2 text-sm leading-relaxed">
                            {requestReason}
                          </p>
                          <code className="bg-background/80 border-border/70 mt-3 block overflow-x-auto rounded-lg border px-3 py-2 font-mono text-xs">
                            {firma(herramienta)}
                          </code>
                          <div className="mt-3.5 flex gap-2">
                            <Button
                              size="sm"
                              onClick={() =>
                                id && void addToolApprovalResponse({ id, approved: true })
                              }
                            >
                              Autorizar
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                id && void addToolApprovalResponse({ id, approved: false })
                              }
                            >
                              Rechazar
                            </Button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <Tool key={clave} className="w-full">
                        <ToolHeader type={herramienta.type} state={herramienta.state} />
                        <ToolContent>
                          <ToolInput input={herramienta.input} />
                          <ToolOutput
                            output={herramienta.output}
                            errorText={herramienta.errorText}
                          />
                        </ToolContent>
                      </Tool>
                    );
                  })}
                </MessageContent>
              </Message>
            ))
          )}

          {actividad && (
            <div
              className="border-primary/30 bg-accent/30 flex items-center gap-2.5 rounded-xl border border-dashed px-3.5 py-2.5"
              role="status"
              aria-live="polite"
            >
              <span className="relative flex size-1.5 shrink-0">
                <span className="bg-primary absolute inline-flex size-full animate-ping rounded-full opacity-70" />
                <span className="bg-primary relative inline-flex size-1.5 rounded-full" />
              </span>
              <span className="font-mono text-xs">{actividad}</span>
              <span className="text-muted-foreground tabular ml-auto font-mono text-[11px]">
                paso {usos.length + 1}
              </span>
            </div>
          )}

          {messages.some((m) => m.role === "assistant" && m.parts.some((p) => p.type === "text")) &&
            !trabajando && (
              <div className="border-border/60 text-muted-foreground flex items-start gap-2.5 rounded-xl border border-dashed px-3.5 py-2.5 text-xs leading-relaxed">
                <ShieldOff className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                <span>
                  Esta respuesta no fue sometida a verificación. En modo conversacional el agente
                  entrega prosa, y sobre prosa no existe contrato que validar: las seis
                  comprobaciones deterministas y el evaluador operan sobre el agente de contrato
                  estricto. Las ejecuciones verificadas figuran en <strong>Monitoreo</strong>.
                </span>
              </div>
            )}

          {error && (
            <div className="border-destructive/40 bg-destructive/5 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="text-destructive font-medium">La ejecución no se completó</p>
                <p className="text-muted-foreground mt-1 break-words">{error.message}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => void regenerate()}>
                <RotateCcw className="size-4" /> Reintentar
              </Button>
            </div>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="mx-auto w-full max-w-2xl px-4 pb-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            enviar(texto);
          }}
          className="border-border/70 bg-card focus-within:border-primary/50 focus-within:ring-primary/10 flex items-end gap-2 rounded-2xl border p-2 shadow-sm transition-all focus-within:ring-4"
        >
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                enviar(texto);
              }
            }}
            rows={1}
            placeholder="Formule una consulta sobre la requisición"
            aria-label="Consulta"
            className="max-h-40 min-h-9 flex-1 resize-none bg-transparent px-2.5 py-1.5 text-sm outline-none"
          />
          <Button
            type={trabajando ? "button" : "submit"}
            onClick={trabajando ? () => void stop() : undefined}
            size="icon"
            aria-label={trabajando ? "Detener" : "Enviar"}
            disabled={!trabajando && texto.trim() === ""}
            className="size-9 shrink-0 rounded-xl"
          >
            {trabajando ? <Square className="size-3.5" /> : <ArrowUp className="size-4" />}
          </Button>
        </form>
      </div>
    </div>
  );
}
