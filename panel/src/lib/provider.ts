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

type Role = "agent" | "judge";

function settingsFor(papel: Role) {
  const prefix = papel === "judge" ? "JUDGE_" : "";
  return {
    languageModel: process.env[`${prefix}PROVIDER`] ?? process.env["PROVIDER"] ?? "google",
    model: process.env[`${prefix}MODEL`] ?? process.env["MODEL"] ?? "",
  };
}

export function languageModel(papel: Role): LanguageModel {
  const { languageModel: name, model } = settingsFor(papel);

  if (name === "openai") {
    const apiKey = process.env["OPENAI_API_KEY"];
    if (!apiKey) throw new Error("Falta OPENAI_API_KEY en el .env de la raíz del repositorio.");
    return createOpenAI({ apiKey })(model || "gpt-5.4-mini");
  }

  if (name === "google") {
    const apiKey = process.env["GOOGLE_API_KEY"];
    if (!apiKey) throw new Error("Falta GOOGLE_API_KEY en el .env de la raíz del repositorio.");
    return createGoogleGenerativeAI({ apiKey })(model || "gemini-3.1-flash-lite");
  }

  throw new Error(`Proveedor no reconocido: ${name}. Use "google" u "openai".`);
}
