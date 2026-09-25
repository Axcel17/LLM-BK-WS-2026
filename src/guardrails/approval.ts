/**
 * Compuerta de aprobación.
 *
 * El servidor del catálogo expone `place_order`, que emite la orden de compra
 * en firme. La capacidad existe porque en el sistema real existe: un agente de
 * abastecimiento opera contra un sistema que sabe comprar.
 *
 * La regla 8 de las instrucciones pide que el agente no adjudique. Eso es un
 * umbral interpretado: una petición al modelo, que puede no atender. Este
 * módulo es el mismo umbral impuesto — el arnés consulta esta función antes de
 * ejecutar cualquier herramienta, y una denegación no depende de que el modelo
 * colabore.
 *
 * La diferencia importa sobre todo bajo inyección. Un texto puede convencer a
 * un modelo de emitir la orden. No puede cambiar esta tabla.
 */

/**
 * Acciones que este agente no ejecuta por sí mismo.
 *
 * El criterio es la reversibilidad: consultar una cotización se deshace
 * cerrando la ventana, emitir una orden no. Lo irreversible se recomienda con
 * evidencia y lo confirma una persona.
 */
export const IRREVERSIBLE_TOOLS: readonly string[] = ["place_order"];

const DENIAL_REASON =
  "Este agente recomienda, no adjudica. La orden en firme la emite una persona " +
  "con el comparativo a la vista.";

/** Una llamada que la compuerta detuvo, con el motivo. */
export interface DeniedCall {
  readonly tool: string;
  readonly input: unknown;
  readonly reason: string;
}

/** Decisión de la compuerta sobre una llamada concreta. */
export type Decision = "not-applicable" | { readonly type: "denied"; readonly reason: string };

/**
 * Construye la compuerta y el registro de lo que detuvo.
 *
 * El registro permite reportar al final qué intentó el agente, que es
 * información de seguridad: una denegación silenciosa esconde justo el evento
 * que hay que revisar.
 */
export function createApprovalGate(): {
  decide: (options: { toolCall: { toolName: string; input: unknown } }) => Decision;
  readonly denied: readonly DeniedCall[];
} {
  const denied: DeniedCall[] = [];

  return {
    denied,
    decide({ toolCall }) {
      if (!IRREVERSIBLE_TOOLS.includes(toolCall.toolName)) return "not-applicable";

      denied.push({ tool: toolCall.toolName, input: toolCall.input, reason: DENIAL_REASON });
      // El arnés devuelve la denegación al modelo como resultado de la
      // herramienta, así que el agente puede continuar y cerrar su informe.
      return { type: "denied", reason: DENIAL_REASON };
    },
  };
}
