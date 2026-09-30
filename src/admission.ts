/**
 * La puerta de entrada: una petición en prosa se vuelve la requisición que
 * gobierna la corrida, o no entra.
 *
 * Compone tres piezas que ya existían sueltas —extraer, comprobar que lo
 * extraído esté en la petición, y fijarlo— porque el orden entre ellas es lo
 * que importa y repetirlo en cada entrada es lo que lo rompe. Mientras esta
 * composición vivió dentro de un script, `npm run agent` recibía la petición
 * del usuario y verificaba el resultado contra el encargo del archivo: dos
 * encargos distintos en la misma corrida, sin que nada fallara.
 *
 * Escalar aquí cuesta una llamada. Escalar después de consultar a cinco
 * proveedores cuesta seis.
 */

import type { LanguageModel } from "ai";

import { governWith, readBrief, type Brief } from "./domain/catalog.js";
import { briefFrom, intake, type IntakeOutcome } from "./domain/intake.js";
import { checkExtraction, type Finding } from "./guardrails/checks.js";

export type Admission =
  /** La petición alcanza para trabajar y ya gobierna la corrida. */
  | { readonly status: "admitted"; readonly brief: Brief; readonly outcome: IntakeOutcome }
  /** Falta algo sin lo cual no hay ronda que consultar. */
  | { readonly status: "incomplete"; readonly outcome: IntakeOutcome }
  /** Lo extraído no está en la petición: el modelo supuso un dato. */
  | { readonly status: "unfounded"; readonly findings: readonly Finding[] };

/**
 * Admite la petición y la deja gobernando, o explica por qué no.
 *
 * Fija `BRIEF_JSON` como parte de admitir, no como paso aparte: una requisición
 * admitida que no gobierna no sirve de nada, y separarlo es justamente lo que
 * permitía olvidarlo.
 */
export async function admitRequest(request: string, model?: LanguageModel): Promise<Admission> {
  const outcome = model === undefined ? await intake(request) : await intake(request, model);

  if (outcome.status !== "complete") return { status: "incomplete", outcome };

  // La extracción se verifica antes de usarse: un valor que no está en la
  // petición no puede gobernar lo que sigue.
  const findings = checkExtraction(outcome, request);
  if (findings.length > 0) return { status: "unfounded", findings };

  const brief = briefFrom(outcome, readBrief().suppliers);
  governWith(brief);
  return { status: "admitted", brief, outcome };
}
