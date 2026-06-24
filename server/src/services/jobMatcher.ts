import type { AIAnalysisResult } from "../types.js";
import { callLLM, hasLLM, parseJson } from "./llm.js";

interface MatchInput {
  title: string;
  company: string;
  requirements: string[];
  description: string;
  resumeText: string;
  profile?: string;
}

/**
 * Scores a resume against an application's requirements.
 * Uses the configured LLM (Gemini/Claude) when available; keyword-overlap fallback otherwise.
 */
export async function matchResume(input: MatchInput): Promise<AIAnalysisResult> {
  if (hasLLM()) {
    try {
      return await matchWithLLM(input);
    } catch (err) {
      console.warn("AI match failed, using fallback:", (err as Error).message);
    }
  }
  return matchWithKeywords(input);
}

function verdictFor(score: number): string {
  if (score >= 85) return "Excellent Match";
  if (score >= 70) return "Strong Match";
  if (score >= 50) return "Fair Match";
  if (score >= 30) return "Weak Match";
  return "Poor Match";
}

async function matchWithLLM(input: MatchInput): Promise<AIAnalysisResult> {
  const { title, company, requirements, description, resumeText, profile } = input;
  const profileBlock = profile?.trim()
    ? `\n\nApplicant profile (self-reported — use alongside the resume):\n${profile.slice(0, 3_000)}`
    : "";
  const raw = await callLLM(
    `You are an application coach. Compare this applicant against the role and judge feasibility. Use BOTH the resume and the applicant profile below. Respond with ONLY a JSON object, no markdown fences:

{ "matchScore": number (0-100, how well the applicant fits the role), "verdict": string (2-3 words, e.g. "Strong Match"), "summary": string (1-2 sentences on overall fit), "suggestions": string[] (3-5 concrete edits to improve the application for THIS role), "gaps": string[] (missing requirements the applicant should address), "strengths": string[] (points that match well) }

Role: ${title} at ${company}
Role summary: ${description.slice(0, 2_000)}
Requirements:
${requirements.map((r) => `- ${r}`).join("\n") || "- (none captured)"}

Applicant resume:
${resumeText.slice(0, 10_000)}${profileBlock}`,
  );
  const parsed = parseJson<Partial<AIAnalysisResult>>(raw);
  const score = clampScore(parsed.matchScore);
  return {
    matchScore: score,
    verdict: parsed.verdict || verdictFor(score),
    summary: parsed.summary || "",
    suggestions: arr(parsed.suggestions),
    gaps: arr(parsed.gaps),
    strengths: arr(parsed.strengths),
  };
}

const STOP = new Set([
  "the", "and", "for", "with", "you", "your", "are", "our", "will", "have",
  "this", "that", "from", "must", "should", "able", "work", "team", "role",
  "provide", "required", "experience", "strong", "good", "plus", "etc",
]);

function tokenize(text: string): Set<string> {
  const out = new Set<string>();
  for (const w of text.toLowerCase().match(/[a-z][a-z+#.]{2,}/g) ?? []) {
    const t = w.replace(/[.]+$/, "");
    if (t.length >= 3 && !STOP.has(t)) out.add(t);
  }
  return out;
}

/** Offline fallback: keyword overlap between requirements and resume. */
function matchWithKeywords(input: MatchInput): AIAnalysisResult {
  const { requirements, resumeText, profile } = input;
  const resumeTokens = tokenize(`${resumeText}\n${profile ?? ""}`);

  const strengths: string[] = [];
  const gaps: string[] = [];
  const reqs = requirements.length
    ? requirements
    : [input.title, input.description];

  let matched = 0;
  for (const req of reqs) {
    const cleaned = req.replace(/^Provide:\s*/i, "").replace(/\s*\(required\)/i, "").trim();
    if (!cleaned) continue;
    const reqTokens = [...tokenize(cleaned)];
    if (reqTokens.length === 0) continue;
    const hits = reqTokens.filter((t) => resumeTokens.has(t)).length;
    const ratio = hits / reqTokens.length;
    if (ratio >= 0.5) {
      matched++;
      if (strengths.length < 5) strengths.push(cleaned);
    } else if (gaps.length < 5) {
      gaps.push(cleaned);
    }
  }

  const counted = reqs.filter((r) => tokenize(r).size > 0).length || 1;
  const score = clampScore(Math.round((matched / counted) * 100));

  const suggestions = gaps
    .slice(0, 5)
    .map((g) => `Add detail showing how you meet: ${g}`);
  if (suggestions.length === 0) {
    suggestions.push("Resume covers the stated requirements — quantify your impact with metrics.");
  }

  return {
    matchScore: score,
    verdict: verdictFor(score),
    summary: `Keyword match: your resume covers ${matched} of ${counted} requirement${counted === 1 ? "" : "s"}. (Heuristic estimate — set ANTHROPIC_API_KEY for a deeper analysis.)`,
    suggestions,
    gaps,
    strengths,
  };
}

function clampScore(n: unknown): number {
  const x = Math.round(Number(n));
  if (Number.isNaN(x)) return 0;
  return Math.max(0, Math.min(100, x));
}

function arr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((s) => typeof s === "string") : [];
}
