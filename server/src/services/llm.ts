import { GoogleGenAI } from "@google/genai";
import { OpenAI } from "openai";

/**
 * Single LLM gateway used by parse / task-gen / match.
 *
 * Providers are tried in priority order, falling through to the next on any
 * error (e.g. OpenAI out of quota → Gemini). If all fail, callLLM throws and
 * callers use their offline heuristic fallback.
 *
 *   OPENAI_API_KEY    → OpenAI (or any OpenAI-compatible endpoint via OPENAI_BASE_URL)
 *   VERTEX_PROJECT    → Vertex AI (Gemini via ADC; uses your GCP credits)
 *   GEMINI_API_KEY    → Google AI Studio (Gemini, free tier)
 *   ANTHROPIC_API_KEY → Anthropic Claude (paid)
 *   none              → hasLLM() is false.
 *
 * Returns the model's raw text. Callers strip code fences + JSON.parse.
 */

export type LlmProvider = "openai" | "vertex" | "gemini" | "anthropic";

/** Configured providers in priority order. */
export function providerChain(): LlmProvider[] {
  const chain: LlmProvider[] = [];
  if (process.env.OPENAI_API_KEY) chain.push("openai");
  // vertex + gemini both route through callGoogle (auto-selects vertex first),
  // so list only one to avoid calling the same backend twice.
  if (process.env.VERTEX_PROJECT) chain.push("vertex");
  else if (process.env.GEMINI_API_KEY) chain.push("gemini");
  if (process.env.ANTHROPIC_API_KEY) chain.push("anthropic");
  return chain;
}

/** Highest-priority configured provider, or null. */
export function activeProvider(): LlmProvider | null {
  return providerChain()[0] ?? null;
}

export function hasLLM(): boolean {
  return providerChain().length > 0;
}

interface CallOpts {
  maxTokens?: number;
}

function callProvider(provider: LlmProvider, prompt: string, opts: CallOpts): Promise<string> {
  if (provider === "openai") return callOpenAI(prompt, opts);
  if (provider === "vertex" || provider === "gemini") return callGoogle(prompt, opts);
  return callAnthropic(prompt, opts);
}

/** Rejects if a provider call runs longer than the serverless budget allows. */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`provider timed out after ${ms}ms`)), ms).unref?.(),
    ),
  ]);
}

// Hard ceiling per provider attempt — keeps the whole request under the
// platform's function cap (Vercel Hobby = 60s) so a slow model falls through
// to the next provider / heuristic instead of returning a 504.
const PROVIDER_TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS ?? 45_000);

export async function callLLM(prompt: string, opts: CallOpts = {}): Promise<string> {
  const chain = providerChain();
  if (chain.length === 0) throw new Error("No LLM provider configured");
  let lastErr: unknown;
  for (const provider of chain) {
    try {
      return await withTimeout(callProvider(provider, prompt, opts), PROVIDER_TIMEOUT_MS);
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[llm] ${provider} failed (${msg}) — falling back to next provider`);
    }
  }
  throw lastErr ?? new Error("All LLM providers failed");
}

// --- OpenAI (real API, or any OpenAI-compatible endpoint via OPENAI_BASE_URL) ---

let openaiClient: OpenAI | null = null;

function openaiClientInstance(): OpenAI {
  if (openaiClient) return openaiClient;
  openaiClient = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY!,
    // Empty → real OpenAI. Point at Groq / gpt-oss etc. to exercise this exact
    // code path for free; clear it at finals and only the key changes.
    baseURL: process.env.OPENAI_BASE_URL || undefined,
    // Abort before the serverless 60s cap so a slow provider falls through to
    // the next provider / heuristic instead of returning a 504.
    timeout: 50_000,
    maxRetries: 0,
  });
  return openaiClient;
}

async function callOpenAI(prompt: string, opts: CallOpts): Promise<string> {
  // Reasoning models (gpt-oss, o-series) spend tokens "thinking" before output;
  // OPENAI_REASONING_EFFORT=low keeps latency under the serverless cap. Sent
  // only when set, since instruct-only models reject the field.
  const reasoningEffort = process.env.OPENAI_REASONING_EFFORT;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params: any = {
    model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
    messages: [
      // json_object mode requires "json" to appear in the messages; this also
      // keeps output fence-free so the shared parseJson() works unchanged.
      { role: "system", content: "Respond with valid JSON only — no markdown, no code fences." },
      { role: "user", content: prompt },
    ],
    // max_completion_tokens (not the deprecated max_tokens) so newer/reasoning
    // models accept it too. Temperature left at default for the same reason.
    max_completion_tokens: opts.maxTokens ?? 2048,
    response_format: { type: "json_object" },
    ...(reasoningEffort ? { reasoning_effort: reasoningEffort } : {}),
  };
  const res = await openaiClientInstance().chat.completions.create(params);
  const text = res.choices[0]?.message?.content;
  if (!text) throw new Error("OpenAI returned no text");
  return text;
}

// --- Google (Vertex AI via ADC, or AI Studio via API key) ---

let genai: GoogleGenAI | null = null;

function googleClient(): GoogleGenAI {
  if (genai) return genai;
  if (process.env.VERTEX_PROJECT) {
    genai = new GoogleGenAI({
      vertexai: true,
      project: process.env.VERTEX_PROJECT,
      location: process.env.VERTEX_LOCATION ?? "global",
      // Auth precedence:
      //  - GOOGLE_SERVICE_ACCOUNT_KEY (JSON string) → prod (Vercel/Render, no gcloud)
      //  - else ADC: google-auth-library reads GOOGLE_APPLICATION_CREDENTIALS / gcloud login
      ...(process.env.GOOGLE_SERVICE_ACCOUNT_KEY
        ? {
            googleAuthOptions: {
              credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY),
            },
          }
        : {}),
    });
  } else {
    genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  }
  return genai;
}

function googleModel(): string {
  if (process.env.VERTEX_PROJECT) {
    return process.env.VERTEX_MODEL ?? "gemini-2.5-pro";
  }
  return process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
}

async function callGoogle(prompt: string, opts: CallOpts): Promise<string> {
  const ai = googleClient();
  const resp = await ai.models.generateContent({
    model: googleModel(),
    contents: prompt,
    config: {
      // Thinking models (2.5-pro) spend output tokens on reasoning — keep headroom.
      maxOutputTokens: opts.maxTokens ?? 4096,
      temperature: 0.2,
      responseMimeType: "application/json",
    },
  });
  const text = resp.text;
  if (!text) throw new Error("Gemini returned no text");
  return text;
}

// --- Anthropic Claude ---

async function callAnthropic(prompt: string, opts: CallOpts): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6",
      max_tokens: opts.maxTokens ?? 1024,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic API returned ${res.status}`);
  const data = (await res.json()) as {
    content: Array<{ type: string; text?: string }>;
  };
  const text = data.content.find((b) => b.type === "text")?.text;
  if (!text) throw new Error("Anthropic returned no text");
  return text;
}

/** Strips markdown code fences and parses JSON from a model reply. */
export function parseJson<T>(raw: string): T {
  return JSON.parse(raw.replace(/^```(json)?|```$/g, "").trim()) as T;
}
