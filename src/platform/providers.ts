/**
 * Selección de proveedor de modelo.
 *
 * El proveedor solo interviene aquí: el resto del sistema recibe un modelo ya
 * construido y no se entera de cuál es. Cambiar de proveedor es cambiar dos
 * líneas de configuración.
 */

import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

export type ProviderName = "google" | "openai";

const API_KEY_BY_PROVIDER: Record<ProviderName, string> = {
  google: "GOOGLE_API_KEY",
  openai: "OPENAI_API_KEY",
};

function requireApiKey(provider: ProviderName): string {
  const variable = API_KEY_BY_PROVIDER[provider];
  const key = process.env[variable];
  if (!key) throw new Error(`Falta ${variable} en el entorno. Revise .env.example`);
  return key;
}

/** Construye el modelo indicado por las variables de entorno. */
export function resolveModel(role: "agent" | "judge" = "agent"): LanguageModel {
  const prefix = role === "judge" ? "JUDGE_" : "";
  const provider = (process.env[`${prefix}PROVIDER`] ??
    process.env.PROVIDER ??
    "google") as ProviderName;
  const modelId = process.env[`${prefix}MODEL`] ?? process.env.MODEL ?? "gemini-3.1-flash-lite";

  if (!(provider in API_KEY_BY_PROVIDER)) {
    throw new Error(`PROVIDER '${provider}' no reconocido. Use google u openai.`);
  }

  if (provider === "google") {
    return createGoogleGenerativeAI({ apiKey: requireApiKey("google") })(modelId);
  }
  return createOpenAI({ apiKey: requireApiKey("openai") })(modelId);
}
