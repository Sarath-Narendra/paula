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

// Transient Gemini errors worth retrying: overload (503/UNAVAILABLE), internal
// (500), gateway hiccups, and momentary rate limits. Permanent errors (bad
// request, auth) don't match and surface immediately.
const RETRYABLE = /\b(429|500|502|503|504)\b|UNAVAILABLE|INTERNAL|RESOURCE_EXHAUSTED|overloaded|high demand|deadline exceeded/i;

type GenerateParams = Parameters<GoogleGenAI["models"]["generateContent"]>[0];

/** Call Gemini with exponential backoff so a transient 503 recovers silently. */
async function generateWithRetry(params: GenerateParams, attempts = 4) {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await ai().models.generateContent(params);
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      if (i === attempts - 1 || !RETRYABLE.test(msg)) throw err;
      // 0.5s, 1s, 2s (+ jitter) — fast enough for an interactive request.
      await new Promise((r) => setTimeout(r, 500 * 2 ** i + Math.random() * 250));
    }
  }
  throw lastErr;
}

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
  const res = await generateWithRetry({
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
  const res = await generateWithRetry({
    model: opts.model ?? env.geminiModelFlash,
    contents: opts.prompt,
    config: {
      systemInstruction: opts.system,
      temperature: opts.temperature ?? 0.6,
    },
  });
  return (res.text ?? "").trim();
}
