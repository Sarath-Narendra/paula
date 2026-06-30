import "server-only";
import { GoogleGenAI, Type, type Schema } from "@google/genai";
import { env } from "@/lib/env";

let _ai: GoogleGenAI | undefined;

export function ai(): GoogleGenAI {
  if (!_ai) _ai = new GoogleGenAI({ apiKey: env.geminiApiKey });
  return _ai;
}

export { Type };
export type { Schema };

/**
 * Generate a structured JSON object validated against a Gemini response schema.
 * Throws if the model returns unparseable JSON.
 */
export async function generateJSON<T>(opts: {
  prompt: string;
  schema: Schema;
  system?: string;
  model?: string;
  temperature?: number;
}): Promise<T> {
  const res = await ai().models.generateContent({
    model: opts.model ?? env.geminiModelFlash,
    contents: opts.prompt,
    config: {
      systemInstruction: opts.system,
      responseMimeType: "application/json",
      responseSchema: opts.schema,
      temperature: opts.temperature ?? 0.4,
    },
  });
  const text = res.text ?? "";
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Gemini returned non-JSON output: ${text.slice(0, 200)}`);
  }
}

/** Generate a short natural-language string (no schema). */
export async function generateText(opts: {
  prompt: string;
  system?: string;
  model?: string;
  temperature?: number;
}): Promise<string> {
  const res = await ai().models.generateContent({
    model: opts.model ?? env.geminiModelFlash,
    contents: opts.prompt,
    config: {
      systemInstruction: opts.system,
      temperature: opts.temperature ?? 0.6,
    },
  });
  return (res.text ?? "").trim();
}
