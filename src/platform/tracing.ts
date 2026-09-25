/**
 * Instrumentación con las convenciones semánticas GenAI de OpenTelemetry.
 *
 * El arnés no emite spans por sí solo: expone eventos del ciclo de vida y se le
 * registra una integración que los traduce. Este módulo es esa integración, y
 * hace explícito el mapeo entre lo que ocurre y los atributos del estándar:
 *
 *     gen_ai.operation.name    chat | execute_tool
 *     gen_ai.request.model
 *     gen_ai.usage.input_tokens / output_tokens
 *     gen_ai.tool.name
 *
 * A diferencia de imprimir la traza, esto sale del proceso: un recolector
 * externo la recibe sin que el código sepa cuál es, y sirve para medir latencia,
 * costo y tasa de error sin modificar el agente.
 *
 * Las convenciones GenAI están en estado Development, por debajo de Stable: los
 * nombres de atributo pueden cambiar entre versiones.
 */

import { trace, type Span } from "@opentelemetry/api";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { ConsoleSpanExporter, SimpleSpanProcessor } from "@opentelemetry/sdk-trace-node";
import { registerTelemetry, type Telemetry } from "ai";

let sdk: NodeSDK | undefined;

/** Spans abiertos, por identificador de llamada, hasta que su evento de cierre llega. */
const openSpans = new Map<string, Span>();

function tracer() {
  return trace.getTracer("quote-comparison-agent");
}

/** Traduce los eventos del arnés a spans con atributos GenAI. */
const openTelemetryIntegration = {
  onLanguageModelCallStart: (event) => {
    const span = tracer().startSpan("chat", {
      attributes: {
        "gen_ai.operation.name": "chat",
        "gen_ai.request.model": event.modelId,
        "gen_ai.provider.name": event.provider,
      },
    });
    openSpans.set(event.callId, span);
  },

  onLanguageModelCallEnd: (event) => {
    const span = openSpans.get(event.callId);
    if (!span) return;
    span.setAttribute("gen_ai.usage.input_tokens", event.usage?.inputTokens ?? 0);
    span.setAttribute("gen_ai.usage.output_tokens", event.usage?.outputTokens ?? 0);
    // Cuánto de la entrada se sirvió de caché, para ver el efecto por llamada.
    const cached = event.usage?.inputTokenDetails?.cacheReadTokens;
    if (cached !== undefined) span.setAttribute("gen_ai.usage.cached_input_tokens", cached);
    span.end();
    openSpans.delete(event.callId);
  },

  onToolExecutionStart: (event) => {
    // El tipo ensanchado no expone la herramienta porque distingue estáticas
    // de dinámicas. El nombre viaja dentro de `toolCall`.
    const toolName = event.toolCall.toolName;
    const span = tracer().startSpan(`execute_tool ${toolName}`, {
      attributes: {
        "gen_ai.operation.name": "execute_tool",
        "gen_ai.tool.name": toolName,
      },
    });
    openSpans.set(event.callId, span);
  },

  onToolExecutionEnd: (event) => {
    openSpans.get(event.callId)?.end();
    openSpans.delete(event.callId);
  },
} satisfies Telemetry;

/** Activa la exportación de spans por consola. Idempotente. */
export function enableTracing(): void {
  if (sdk) return;
  sdk = new NodeSDK({ spanProcessors: [new SimpleSpanProcessor(new ConsoleSpanExporter())] });
  sdk.start();
  registerTelemetry(openTelemetryIntegration);
}

export async function shutdownTracing(): Promise<void> {
  for (const span of openSpans.values()) span.end();
  openSpans.clear();
  await sdk?.shutdown();
  sdk = undefined;
}

/** True si el entorno pide trazas. */
export function tracingRequested(): boolean {
  return ["1", "si", "true"].includes((process.env["TRACING"] ?? "").toLowerCase());
}
