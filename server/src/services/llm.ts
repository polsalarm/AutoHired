import { GoogleGenAI } from "@google/genai";

/**
 * Single LLM gateway used by parse / task-gen / match.
 *
 * Provider selection (first match wins):
 *   VERTEX_PROJECT    → Vertex AI (Gemini via ADC; uses your GCP credits)
 *   GEMINI_API_KEY    → Google AI Studio (Gemini, free tier)
 *   ANTHROPIC_API_KEY → Anthropic Claude (paid)
 *   none              → hasLLM() is false; callers use their heuristic fallback.
 *
 * Returns the model's raw text. Callers strip code fences + JSON.parse.
 */

export type LlmProvider = "vertex" | "gemini" | "anthropic" | null;

export function activeProvider(): LlmProvider {
  if (process.env.VERTEX_PROJECT) return "vertex";
  if (process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  return null;
}

export function hasLLM(): boolean {
  return activeProvider() !== null;
}

interface CallOpts {
  maxTokens?: number;
}

export async function callLLM(prompt: string, opts: CallOpts = {}): Promise<string> {
  const provider = activeProvider();
  if (provider === "vertex" || provider === "gemini") return callGoogle(prompt, opts);
  if (provider === "anthropic") return callAnthropic(prompt, opts);
  throw new Error("No LLM provider configured");
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
