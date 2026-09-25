/**
 * Presentación de una corrida en consola.
 *
 * Reúne todo lo que el sistema escribe por salida estándar. Separarlo de la
 * orquestación permite que `agent.ts` devuelva datos en lugar de imprimirlos, y
 * que esos datos se verifiquen en una prueba sin capturar texto.
 *
 * Ninguna función de este módulo decide nada: solo da forma a lo que ya se
 * calculó.
 */

import type { CompletedQuery } from "./agent.js";
import type { DeniedCall } from "./guardrails/approval.js";
import type { Finding } from "./guardrails/checks.js";
import type { Verdict } from "./guardrails/judge.js";
import { hasDrift, type DriftReport } from "./mcp/integrity.js";
import type { Comparison } from "./domain/schemas.js";

/** Consumo de una corrida, con el detalle por paso. */
export interface UsageReport {
  readonly steps?: ReadonlyArray<{ usage: unknown }>;
  readonly usage: unknown;
}

/**
 * Desglose de consumo, paso por paso.
 *
 * Cada vuelta del bucle reenvía la conversación completa más las definiciones
 * de herramientas, así que la entrada crece con cada paso. En un flujo largo
 * ese crecimiento domina el costo, no la salida.
 *
 * `cacheReadTokens` indica cuánto de esa entrada repetida se sirvió de caché.
 * Los proveedores solo cachean a partir de un prefijo mínimo —del orden de mil
 * tokens—, de modo que un agente pequeño no alcanza el umbral y paga la entrada
 * completa en cada paso.
 */
export function formatUsage(result: UsageReport): string {
  const steps = result.steps ?? [];
  const total = result.usage as {
    inputTokens?: number;
    outputTokens?: number;
    inputTokenDetails?: { cacheReadTokens?: number };
  };

  const lines = ["", "CONSUMO"];

  for (const [index, step] of steps.entries()) {
    const usage = step.usage as { inputTokens?: number; outputTokens?: number };
    lines.push(
      `  paso ${index + 1}: ${String(usage.inputTokens ?? 0).padStart(6)} entrada  ` +
        `${String(usage.outputTokens ?? 0).padStart(5)} salida`,
    );
  }

  const cached = total.inputTokenDetails?.cacheReadTokens ?? 0;
  const input = total.inputTokens ?? 0;
  const cachedShare = input > 0 ? Math.round((cached / input) * 100) : 0;

  lines.push(
    `  total:  ${String(input).padStart(6)} entrada  ` +
      `${String(total.outputTokens ?? 0).padStart(5)} salida  ` +
      `· ${cached} de caché (${cachedShare} %)`,
  );

  return lines.join("\n");
}

/** El comparativo, ordenado por total y con las ausencias al final. */
export function formatComparison(comparison: Comparison): string {
  const lines = ["", "COMPARATIVO"];

  const byTotal = [...comparison.quotes].sort((a, b) => a.totalDeliveredUsd - b.totalDeliveredUsd);

  for (const quote of byTotal) {
    const meets = quote.meetsLeadTime && quote.meetsBudget ? "ok " : "NO ";
    const lead = quote.leadTimeBusinessDays === null ? "n/d" : `${quote.leadTimeBusinessDays} d`;
    lines.push(
      `  ${meets} ${quote.supplier.padEnd(20)} ` +
        `${String(quote.totalDeliveredUsd).padStart(10)} ${lead.padStart(7)}`,
    );
  }

  for (const entry of comparison.noResponse) {
    lines.push(`  --  ${entry.supplier.padEnd(20)} ${"sin cotización".padStart(10)}`);
  }

  lines.push("", `  Recomendado: ${comparison.recommendedSupplier ?? "ninguno"}`);

  if (comparison.anomalies.length > 0) {
    lines.push("", "ANOMALÍAS DE CONTENIDO EXTERNO");
    for (const anomaly of comparison.anomalies) {
      lines.push(`  ${anomaly.supplier}: ${anomaly.whatItAskedFor}`);
    }
  }

  return lines.join("\n");
}

/**
 * Traspaso a una persona.
 *
 * Informar que la ejecución se detuvo no basta. Quien recibe el caso necesita
 * saber qué se consultó, o repetirá desde cero el trabajo que el agente
 * alcanzó a hacer.
 */
export function formatHandoff(gathered: readonly CompletedQuery[]): string {
  const lines = ["", "  LO QUE YA SE AVERIGUÓ"];

  if (gathered.length === 0) {
    lines.push("    Sin consultas completadas: la ejecución se detuvo antes de la primera.");
    return lines.join("\n");
  }

  for (const query of gathered) {
    const args =
      query.input && typeof query.input === "object"
        ? Object.values(query.input as Record<string, unknown>).join(", ")
        : "";
    lines.push(`    ${`${query.tool}(${args})`.padEnd(40)} ${query.characters} caracteres`);
  }

  lines.push("", "    Quien retome el caso no necesita repetir estas consultas.");
  return lines.join("\n");
}

/**
 * Estado del catálogo frente a la huella registrada.
 *
 * Se informa antes de ejecutar nada: si las herramientas cambiaron, todo lo
 * que venga después se produjo con un catálogo distinto del que se revisó.
 */
export function formatIntegrity(report: DriftReport): string {
  if (!report.hasBaseline) {
    return "INTEGRIDAD  sin huella de referencia. `npm run baseline` la registra.";
  }

  if (!hasDrift(report)) {
    return "INTEGRIDAD  el catálogo coincide con la huella registrada.";
  }

  const lines = ["INTEGRIDAD  el catálogo cambió desde la última huella:"];
  if (report.changed.length > 0) lines.push(`  definición distinta: ${report.changed.join(", ")}`);
  if (report.added.length > 0) lines.push(`  nuevas:              ${report.added.join(", ")}`);
  if (report.removed.length > 0) lines.push(`  desaparecidas:       ${report.removed.join(", ")}`);
  lines.push(
    "  El cambio puede corresponder a una versión nueva del servidor. Conviene revisarlo.",
  );

  return lines.join("\n");
}

/**
 * Lo que la compuerta detuvo.
 *
 * Una denegación silenciosa oculta justo el evento que debe revisarse: el
 * agente intentó ejecutar una acción irreversible.
 */
export function formatDenied(denied: readonly DeniedCall[]): string {
  if (denied.length === 0) return "";

  const lines = ["", "COMPUERTA DE APROBACIÓN"];
  for (const call of denied) {
    lines.push(`  DENEGADO  ${call.tool}(${JSON.stringify(call.input)})`);
  }
  lines.push(`  ${denied[0]?.reason ?? ""}`);

  return lines.join("\n");
}

/** Resultado de la primera capa de evaluación. */
export function formatChecks(findings: readonly Finding[]): string {
  const lines = ["", "CAPA 1 · VERIFICACIÓN POR CÓDIGO"];

  if (findings.length === 0) {
    lines.push("  Las seis pasan.");
    return lines.join("\n");
  }

  for (const finding of findings) lines.push(`  [${finding.check}] ${finding.detail}`);
  lines.push("", `  ${findings.length} hallazgo(s). La salida no es confiable.`);

  return lines.join("\n");
}

/** Resultado de la segunda capa de evaluación. */
export function formatJudgement(verdict: Verdict): string {
  return [
    "",
    "CAPA 2 · EVALUADOR POR MODELO",
    `  Evidencia suficiente: ${verdict.evidenceIsSufficient}`,
    `  Descartes explicados: ${verdict.rejectionsAreExplained}`,
    `  Anomalía reportada:   ${verdict.anomalyIsReported}`,
    "",
    `  ${verdict.note}`,
  ].join("\n");
}
