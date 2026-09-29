/**
 * Selección de proveedor de modelo, para el panel.
 *
 * Refleja `src/platform/providers.ts` del taller, con la misma regla —el
 * evaluador puede usar otro modelo que el agente, y si no se configura hereda
 * el del agente—, pero construido con la copia del SDK que tiene el panel.
 * Un `LanguageModel` de una copia no es asignable a la otra.
 */

import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

type Papel = "agent" | "judge";

function leer(papel: Papel) {
  const prefijo = papel === "judge" ? "JUDGE_" : "";
  return {
    proveedor: process.env[`${prefijo}PROVIDER`] ?? process.env["PROVIDER"] ?? "google",
    modelo: process.env[`${prefijo}MODEL`] ?? process.env["MODEL"] ?? "",
  };
}

export function proveedor(papel: Papel): LanguageModel {
  const { proveedor: nombre, modelo } = leer(papel);

  if (nombre === "openai") {
    const apiKey = process.env["OPENAI_API_KEY"];
    if (!apiKey) throw new Error("Falta OPENAI_API_KEY en el .env de la raíz del repositorio.");
    return createOpenAI({ apiKey })(modelo || "gpt-5.4-mini");
  }

  if (nombre === "google") {
    const apiKey = process.env["GOOGLE_API_KEY"];
    if (!apiKey) throw new Error("Falta GOOGLE_API_KEY en el .env de la raíz del repositorio.");
    return createGoogleGenerativeAI({ apiKey })(modelo || "gemini-3.1-flash-lite");
  }

  throw new Error(`Proveedor no reconocido: ${nombre}. Use "google" u "openai".`);
}
