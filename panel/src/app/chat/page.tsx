"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useState } from "react";
import { ArrowUp, Square } from "lucide-react";

import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
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
import { Button } from "@/components/ui/button";

/** Peticiones que muestran algo que vale la pena ver, no saludos. */
const SUGERENCIAS = [
  "Consulta las cinco cotizaciones y dime cuál recomiendas, con la evidencia.",
  "¿Cuál es el más barato y por qué no deberíamos elegirlo?",
  "Lee la cotización de GlobalStock y dime si hay algo raro en ella.",
  "Emite la orden de compra al proveedor que recomendaste.",
];

export default function Chat() {
  const [texto, setTexto] = useState("");
  const { messages, sendMessage, status, stop, error } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });

  const trabajando = status === "submitted" || status === "streaming";

  function enviar(contenido: string) {
    const limpio = contenido.trim();
    if (limpio === "" || trabajando) return;
    void sendMessage({ text: limpio });
    setTexto("");
  }

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col px-4">
      <Conversation className="min-h-0 flex-1">
        <ConversationContent className="gap-5 py-6">
          {messages.length === 0 && (
            <ConversationEmptyState
              title="El agente de abastecimiento"
              description="Tiene las mismas ocho reglas y las mismas herramientas MCP que la corrida de la terminal. Lo que cambia es que aquí puede conversar: no hay contrato de salida."
            >
              <div className="mt-5 grid w-full gap-2">
                {SUGERENCIAS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => enviar(s)}
                    className="border-border/70 hover:bg-muted/60 rounded-lg border px-3.5 py-2.5 text-left text-sm transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </ConversationEmptyState>
          )}

          {messages.map((mensaje) => (
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

                  if (parte.type.startsWith("tool-")) {
                    const herramienta = parte as unknown as {
                      type: string;
                      state:
                        "input-streaming" | "input-available" | "output-available" | "output-error";
                      input?: unknown;
                      output?: unknown;
                      errorText?: string;
                    };
                    return (
                      <Tool key={clave} className="w-full">
                        <ToolHeader
                          type={herramienta.type as `tool-${string}`}
                          state={herramienta.state}
                        />
                        <ToolContent>
                          <ToolInput input={herramienta.input} />
                          <ToolOutput
                            output={herramienta.output}
                            errorText={herramienta.errorText}
                          />
                        </ToolContent>
                      </Tool>
                    );
                  }

                  return null;
                })}
              </MessageContent>
            </Message>
          ))}

          {error && (
            <div className="border-destructive/40 bg-destructive/5 text-destructive rounded-lg border px-3.5 py-2.5 text-sm">
              {error.message}
            </div>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          enviar(texto);
        }}
        className="border-border/70 bg-background focus-within:border-foreground/25 mb-5 flex items-end gap-2 rounded-xl border p-2 shadow-sm transition-colors"
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
          placeholder="Pregúntele algo al agente…"
          aria-label="Mensaje para el agente"
          className="max-h-40 min-h-9 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none"
        />
        <Button
          type={trabajando ? "button" : "submit"}
          onClick={trabajando ? () => void stop() : undefined}
          size="icon"
          aria-label={trabajando ? "Detener" : "Enviar"}
          disabled={!trabajando && texto.trim() === ""}
          className="size-9 shrink-0 rounded-lg"
        >
          {trabajando ? <Square className="size-4" /> : <ArrowUp className="size-4" />}
        </Button>
      </form>
    </div>
  );
}
