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
import { SessionBar, type AgentTool } from "@/components/session-bar";
import { Button } from "@/components/ui/button";
import type { Requisition } from "@/lib/workshop";

export type AgentCard = {
  model: string;
  stepLimit: number;
  tools: Array<AgentTool & { needsApproval: boolean }>;
  rules: string[];
};

/**
 * Aperturas que funcionan desde cero.
 *
 * Una apertura que supone trabajo previo —«¿por qué no el más barato?»— obliga
 * al agente a explicar sus reglas en abstracto en vez de trabajar, porque
 * todavía no ha consultado nada. Estas cuatro se pueden responder consultando.
 */
const OPENERS = [
  {
    draft: "Consulta las cinco cotizaciones y emite una recomendación",
    pista: "Seis invocaciones · el flujo completo",
  },
  {
    draft: "Detalla las restricciones de la requisición",
    pista: "Una invocación · verificación rápida",
  },
  {
    draft: "Analiza la cotización de GlobalStock",
    pista: "Contiene texto dirigido a sistemas automatizados",
  },
  {
    draft: "Emite una orden de compra a Suministros Delta",
    pista: "Se detiene y solicita autorización",
  },
];

type UsageMetadata = { inputTokens?: number; outputTokens?: number; cachedTokens?: number };

function signature(part: ToolUIPart): string {
  const name = part.type.replace(/^tool-/, "");
  const args = part.input && typeof part.input === "object" ? Object.values(part.input) : [];
  return args.length > 0 ? `${name}(${args.join(", ")})` : `${name}()`;
}

export function AgentConversation({
  agentCard,
  encargo,
}: {
  agentCard: AgentCard;
  encargo: Requisition;
}) {
  const [draft, setDraft] = useState("");
  const [needsApproval, setNeedsApproval] = useState<string[]>(
    agentCard.tools.filter((h) => h.needsApproval).map((h) => h.name),
  );

  const { messages, sendMessage, addToolApprovalResponse, regenerate, status, stop, error } =
    useChat({
      transport: new DefaultChatTransport({
        api: "/api/chat",
        // La política viaja con cada petición: lo que se marque arriba es lo
        // que la compuerta aplica en la vuelta siguiente.
        // La requisición admitida viaja con cada petición, igual que la
        // política: es lo que gobierna al servidor MCP de esta conversación.
        prepareSendMessagesRequest: ({ messages: m }) => ({
          body: { messages: m, needsApproval, encargo },
        }),
      }),
    });

  const busy = status === "submitted" || status === "streaming";

  const usage = messages.reduce(
    (acc, m) => {
      const d = (m.metadata ?? {}) as UsageMetadata;
      return {
        inputTokens: Math.max(acc.inputTokens, d.inputTokens ?? 0),
        outputTokens: acc.outputTokens + (d.outputTokens ?? 0),
        cachedTokens: Math.max(acc.cachedTokens, d.cachedTokens ?? 0),
      };
    },
    { inputTokens: 0, outputTokens: 0, cachedTokens: 0 },
  );

  const toolUses = messages.flatMap((m) => m.parts.filter((p) => p.type.startsWith("tool-")));

  const activity = (() => {
    if (!busy) return null;
    const parts = messages.at(-1)?.parts ?? [];
    const running = (parts.filter((p) => p.type.startsWith("tool-")) as ToolUIPart[]).findLast(
      (p) => p.state === "input-available" || p.state === "input-streaming",
    );
    if (running) return `Ejecutando ${signature(running)}`;
    if (parts.some((p) => p.type === "text")) return "Generando respuesta";
    if (parts.some((p) => p.type.startsWith("tool-"))) return "Procesando la respuesta";
    return "Determinando la siguiente invocación";
  })();

  function send(content: string) {
    const trimmed = content.trim();
    if (trimmed === "" || busy) return;
    void sendMessage({ text: trimmed });
    setDraft("");
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SessionBar
        tools={agentCard.tools}
        needsApproval={needsApproval}
        onToggleApproval={(name: string) =>
          setNeedsApproval((prev) =>
            prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name],
          )
        }
        locked={busy}
        steps={toolUses.length}
        stepLimit={agentCard.stepLimit}
        model={agentCard.model}
        {...usage}
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
                toolPart y su result quedan desplegados en la conversación.
              </p>

              <div className="mt-7 grid gap-2 sm:grid-cols-2">
                {OPENERS.map((a) => (
                  <button
                    key={a.draft}
                    type="button"
                    onClick={() => send(a.draft)}
                    className="border-border/70 hover:border-primary/40 hover:bg-accent/40 rounded-xl border px-4 py-3 text-left transition-colors"
                  >
                    <span className="block text-sm font-medium">{a.draft}</span>
                    <span className="text-muted-foreground mt-0.5 block text-xs">{a.pista}</span>
                  </button>
                ))}
              </div>

              <p className="text-muted-foreground border-border/60 mt-7 border-t pt-4 text-xs leading-relaxed">
                <span className="text-foreground/70 font-medium">Restricciones permanentes.</span>{" "}
                {agentCard.rules.join(". ")}.
              </p>
            </div>
          ) : (
            messages.map((message) => (
              <Message from={message.role} key={message.id}>
                <MessageContent>
                  {message.parts.map((part, i) => {
                    const key = `${message.id}-${i}`;

                    if (part.type === "text") {
                      return <MessageResponse key={key}>{part.text}</MessageResponse>;
                    }

                    if (part.type === "reasoning") {
                      return (
                        <Reasoning
                          key={key}
                          className="w-full"
                          isStreaming={status === "streaming"}
                        >
                          <ReasoningTrigger />
                          <ReasoningContent>{part.text}</ReasoningContent>
                        </Reasoning>
                      );
                    }

                    if (!part.type.startsWith("tool-")) return null;
                    const toolPart = part as ToolUIPart;

                    if (toolPart.state === "approval-requested") {
                      const { id, requestReason } =
                        (toolPart as { approval?: { id?: string; requestReason?: string } })
                          .approval ?? {};
                      return (
                        <div
                          key={key}
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
                            {signature(toolPart)}
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
                      <Tool key={key} className="w-full">
                        <ToolHeader type={toolPart.type} state={toolPart.state} />
                        <ToolContent>
                          <ToolInput input={toolPart.input} />
                          <ToolOutput output={toolPart.output} errorText={toolPart.errorText} />
                        </ToolContent>
                      </Tool>
                    );
                  })}
                </MessageContent>
              </Message>
            ))
          )}

          {activity && (
            <div
              className="border-primary/30 bg-accent/30 flex items-center gap-2.5 rounded-xl border border-dashed px-3.5 py-2.5"
              role="status"
              aria-live="polite"
            >
              <span className="relative flex size-1.5 shrink-0">
                <span className="bg-primary absolute inline-flex size-full animate-ping rounded-full opacity-70" />
                <span className="bg-primary relative inline-flex size-1.5 rounded-full" />
              </span>
              <span className="font-mono text-xs">{activity}</span>
              <span className="text-muted-foreground tabular ml-auto font-mono text-[11px]">
                paso {toolUses.length + 1}
              </span>
            </div>
          )}

          {messages.some((m) => m.role === "assistant" && m.parts.some((p) => p.type === "text")) &&
            !busy && (
              <div className="border-border/60 text-muted-foreground flex items-start gap-2.5 rounded-xl border border-dashed px-3.5 py-2.5 text-xs leading-relaxed">
                <ShieldOff className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                <span>
                  Esta respuesta no fue sometida a verificación. En modo conversacional el agente
                  entrega prosa, y sobre prosa no existe contrato que validar: las seis
                  comprobaciones deterministas y el judgeModel operan sobre el agente de contrato
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
            send(draft);
          }}
          className="border-border/70 bg-card focus-within:border-primary/50 focus-within:ring-primary/10 flex items-end gap-2 rounded-2xl border p-2 shadow-sm transition-all focus-within:ring-4"
        >
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(draft);
              }
            }}
            rows={1}
            placeholder="Formule una consulta sobre la requisición"
            aria-label="Consulta"
            className="max-h-40 min-h-9 flex-1 resize-none bg-transparent px-2.5 py-1.5 text-sm outline-none"
          />
          <Button
            type={busy ? "button" : "submit"}
            onClick={busy ? () => void stop() : undefined}
            size="icon"
            aria-label={busy ? "Detener" : "Enviar"}
            disabled={!busy && draft.trim() === ""}
            className="size-9 shrink-0 rounded-xl"
          >
            {busy ? <Square className="size-3.5" /> : <ArrowUp className="size-4" />}
          </Button>
        </form>
      </div>
    </div>
  );
}
