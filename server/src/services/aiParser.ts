import type { ScrapedJob } from "../types.js";
import type { FormField } from "./formExtractor.js";
import { callLLM, hasLLM, parseJson } from "./llm.js";

interface ParseInput {
  url: string;
  pageTitle: string;
  text: string;
  formFields: FormField[];
}

/**
 * Parses scraped page text + form fields into a structured ScrapedJob.
 *
 * Provider selection (CareerHive providerFactory pattern):
 *  - GEMINI_API_KEY / ANTHROPIC_API_KEY set → LLM with structured JSON output.
 *  - Otherwise → heuristic keyword/regex parser (offline/dev fallback).
 *
 * Form fields (e.g. Google Form questions) are folded into requirements so
 * the checklist reflects what the applicant must actually provide.
 */
export async function parseJobText(input: ParseInput): Promise<ScrapedJob> {
  if (hasLLM()) {
    try {
      return await parseWithLLM(input);
    } catch (err) {
      console.warn("AI parse failed, using fallback:", (err as Error).message);
    }
  }
  return parseWithHeuristics(input);
}

function formFieldsBlock(fields: FormField[]): string {
  if (fields.length === 0) return "";
  const lines = fields
    .map((f) => `- ${f.label}${f.required ? " (required)" : ""} [${f.type}]`)
    .join("\n");
  return `\n\nApplication form fields/questions the applicant must complete:\n${lines}`;
}

async function parseWithLLM(input: ParseInput): Promise<ScrapedJob> {
  const { url, pageTitle, text, formFields } = input;
  const raw = await callLLM(
    `Extract structured data from this job/program posting or application form. Respond with ONLY a JSON object matching this TypeScript type, no markdown fences:

{ "title": string, "company": string, "location": string | null, "description": string (2-3 sentence summary), "requirements": string[], "deadline": string | null (ISO date YYYY-MM-DD if stated) }

For "requirements", include both stated qualifications AND anything the applicant must prepare/submit based on the form fields below (e.g. "Resume upload", "500-word essay on leadership", "Portfolio link"). Keep each requirement a single concise line.

Page title: ${pageTitle}
Posting text:
${text.slice(0, 12_000)}${formFieldsBlock(formFields)}`,
  );
  const parsed = parseJson<Omit<ScrapedJob, "url">>(raw);
  return { url, ...parsed };
}

/** Offline fallback: heuristic extraction with regex/keywords + form fields. */
function parseWithHeuristics(input: ParseInput): ScrapedJob {
  const { url, pageTitle, text, formFields } = input;
  const hostname = new URL(url).hostname.replace(/^www\./, "");
  const company = hostname.split(".")[0];
  const sentences = text.split(/(?<=[.!?])\s+/);

  // Stated requirements from prose
  const proseReqs = sentences
    .filter((s) =>
      /\b(require|must have|proficien|experience (with|in)|familiarity|knowledge of|pursuing)\b/i.test(
        s,
      ),
    )
    .slice(0, 8)
    .map((s) => s.trim());

  // Form fields become "provide X" requirements (required ones first)
  const formReqs = [...formFields]
    .sort((a, b) => Number(b.required) - Number(a.required))
    .map((f) => `Provide: ${f.label}${f.required ? " (required)" : ""}`);

  const requirements = [...proseReqs, ...formReqs].slice(0, 25);

  const deadlineMatch = text.match(
    /\b(?:deadline|apply by|closes? on|due)\b[^.]{0,40}?(\d{4}-\d{2}-\d{2}|\w+ \d{1,2},? \d{4})/i,
  );
  let deadline: string | null = null;
  if (deadlineMatch) {
    const d = new Date(deadlineMatch[1]);
    if (!Number.isNaN(d.getTime())) deadline = d.toISOString().slice(0, 10);
  }

  const title =
    pageTitle?.slice(0, 100) ||
    sentences[0]?.slice(0, 80).trim() ||
    "Untitled Role";

  return {
    url,
    title,
    company: company.charAt(0).toUpperCase() + company.slice(1),
    location: null,
    description: sentences.slice(0, 3).join(" ").slice(0, 500),
    requirements,
    deadline,
  };
}
