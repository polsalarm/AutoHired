import type {
  CoverLetter,
  ResumeEducation,
  ResumeExperience,
  ResumeTailorResult,
  TailoredResume,
} from "../types.js";
import { callLLM, hasLLM, parseJson } from "./llm.js";

interface TailorInput {
  title: string;
  company: string;
  requirements: string[];
  description: string;
  resumeText: string;
  profile?: string;
}

/**
 * Rewrites an applicant's resume — and drafts a matching cover letter — targeted
 * at one specific application. Uses the configured LLM when available; falls back
 * to a structure-preserving heuristic that reshapes the raw resume text offline.
 */
export async function tailorResume(input: TailorInput): Promise<ResumeTailorResult> {
  if (hasLLM()) {
    try {
      return await tailorWithLLM(input);
    } catch (err) {
      console.warn("AI resume tailor failed, using fallback:", (err as Error).message);
    }
  }
  return tailorFallback(input);
}

async function tailorWithLLM(input: TailorInput): Promise<ResumeTailorResult> {
  const { title, company, requirements, description, resumeText, profile } = input;
  const profileBlock = profile?.trim()
    ? `\n\nApplicant profile (self-reported — use to fill gaps and confirm details):\n${profile.slice(0, 3_000)}`
    : "";
  const raw = await callLLM(
    `You are an expert resume writer. Rewrite the applicant's resume to target the SPECIFIC role below, and draft a matching one-page cover letter. Surface the experience and skills most relevant to this role, mirror the role's language where the applicant genuinely matches it, and quantify impact in bullets where the source supports it. NEVER invent employers, degrees, dates, or facts the applicant did not provide — only re-emphasize and rephrase real content. CRITICAL: if a job's employer name, location, or dates are not present in the source, set that exact field to an empty string "" — do NOT substitute a generic placeholder (e.g. "Various Roles", "Software Development Roles") and do NOT infer or guess dates. Same for education. An empty field is always better than an invented one. Respond with ONLY a JSON object, no markdown fences:

{
  "resume": {
    "name": string,
    "headline": string (a role-title line aligned to the target, e.g. "Senior Frontend Engineer"),
    "contact": { "email": string, "phone": string, "location": string, "links": string[] },
    "summary": string (2-4 sentences, tuned to THIS role),
    "skills": string[] (ordered most-relevant-first for this role),
    "experience": [ { "role": string, "company": string, "location": string, "period": string, "bullets": string[] (rewritten, impact-focused) } ],
    "education": [ { "degree": string, "institution": string, "period": string, "detail": string } ]
  },
  "coverLetter": {
    "greeting": string (e.g. "Dear Hiring Manager,"),
    "body": string[] — a JSON array of 3-4 SEPARATE paragraph strings (one paragraph per array item; NEVER a single combined string): hook + why this role, relevant proof, fit/closing,
    "closing": string (e.g. "Sincerely,"),
    "signature": string (applicant name)
  },
  "changelog": string[] (4-6 plain-language notes on what you changed for this role and why)
}

Use empty strings / empty arrays for anything genuinely absent — do not fabricate.

Target role: ${title} at ${company}
Role summary: ${description.slice(0, 2_000)}
Requirements:
${requirements.map((r) => `- ${r}`).join("\n") || "- (none captured)"}

Applicant's current resume:
${resumeText.slice(0, 10_000)}${profileBlock}`,
    // Generous cap so the JSON tail (cover letter + changelog) is never truncated.
    // Latency is model-bound, not output-bound, so a higher cap costs ~nothing.
    { maxTokens: 7_000 },
  );
  const parsed = parseJson<Partial<RawResult>>(raw);
  const result = normalizeResult(parsed, input);
  // If the model returned nothing usable, fall back rather than ship an empty PDF.
  if (!result.resume.name && result.resume.experience.length === 0) {
    return tailorFallback(input);
  }
  return result;
}

// ---------- Normalization ----------

interface RawResult {
  resume: Partial<TailoredResume> & {
    contact?: Partial<TailoredResume["contact"]>;
    experience?: Partial<ResumeExperience>[];
    education?: Partial<ResumeEducation>[];
  };
  coverLetter: Partial<CoverLetter>;
  changelog: unknown;
}

function normalizeResult(p: Partial<RawResult>, input: TailorInput): ResumeTailorResult {
  const r = p.resume ?? {};
  const c = p.coverLetter ?? {};
  const resume: TailoredResume = {
    name: str(r.name),
    headline: str(r.headline) || input.title,
    contact: {
      email: str(r.contact?.email),
      phone: str(r.contact?.phone),
      location: str(r.contact?.location),
      links: strArr(r.contact?.links),
    },
    summary: str(r.summary),
    skills: strArr(r.skills),
    experience: (Array.isArray(r.experience) ? r.experience : [])
      .map((e) => ({
        role: str(e?.role),
        company: str(e?.company),
        location: str(e?.location),
        period: str(e?.period),
        bullets: strArr(e?.bullets),
      }))
      .filter((e) => e.role || e.company || e.bullets.length),
    education: (Array.isArray(r.education) ? r.education : [])
      .map((e) => ({
        degree: str(e?.degree),
        institution: str(e?.institution),
        period: str(e?.period),
        detail: str(e?.detail),
      }))
      .filter((e) => e.degree || e.institution),
  };
  const coverLetter: CoverLetter = {
    greeting: str(c.greeting) || "Dear Hiring Manager,",
    body: toParagraphs(c.body),
    closing: str(c.closing) || "Sincerely,",
    signature: str(c.signature) || resume.name,
  };
  return { resume, coverLetter, changelog: strArr(p.changelog) };
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function strArr(v: unknown): string[] {
  return Array.isArray(v)
    ? v.filter((s): s is string => typeof s === "string" && s.trim().length > 0).map((s) => s.trim())
    : [];
}

/**
 * Cover-letter body coercion. The model sometimes returns one big string instead
 * of the requested string[] — strArr would drop that to [] (empty letter). Accept
 * a string OR array, and split any blank-line-separated block into paragraphs.
 */
function toParagraphs(v: unknown): string[] {
  const blocks = Array.isArray(v) ? v : [v];
  return blocks
    .filter((s): s is string => typeof s === "string")
    .flatMap((s) => s.split(/\n{2,}/))
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

// ---------- Offline fallback ----------

/**
 * No-LLM path: reshapes the raw resume text into the structured format without
 * rewriting wording, so the feature still produces a clean PDF + a generic cover
 * letter. Heuristic only — it cannot tailor content, just present it.
 */
function tailorFallback(input: TailorInput): ResumeTailorResult {
  const lines = input.resumeText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const name = lines[0] ?? "Your Name";
  const email = firstMatch(input.resumeText, /[\w.+-]+@[\w-]+\.[\w.-]+/);
  const phone = firstMatch(input.resumeText, /(\+?\d[\d ().-]{7,}\d)/);
  const links = uniq(input.resumeText.match(/https?:\/\/[^\s)]+/g) ?? []);

  // Treat short lines after the header as a rough summary block.
  const summary = lines
    .slice(1)
    .find((l) => l.length > 40 && /[a-z]/.test(l)) ?? "";

  const bullets = lines.filter((l) => /^[-•*]/.test(l)).map((l) => l.replace(/^[-•*]\s*/, ""));

  const resume: TailoredResume = {
    name,
    headline: input.title,
    contact: { email, phone, location: "", links },
    summary,
    skills: [],
    experience: bullets.length
      ? [{ role: "", company: "", location: "", period: "", bullets: bullets.slice(0, 12) }]
      : [],
    education: [],
  };

  const role = input.title || "this role";
  const org = input.company || "your team";
  const coverLetter: CoverLetter = {
    greeting: "Dear Hiring Manager,",
    body: [
      `I am writing to apply for the ${role} position at ${org}. My background aligns with what this role requires, and I am eager to contribute.`,
      `My experience has prepared me to take on the responsibilities outlined for this position. I bring a track record of delivering results and collaborating effectively with teams.`,
      `I would welcome the opportunity to discuss how my skills can support ${org}'s goals. Thank you for considering my application.`,
    ],
    closing: "Sincerely,",
    signature: name,
  };

  return {
    resume,
    coverLetter,
    changelog: [
      "Generated offline (no AI provider configured) — content reformatted, not rewritten.",
      "Set an LLM provider (OPENAI_API_KEY / GEMINI_API_KEY / ANTHROPIC_API_KEY) to tailor wording to this role.",
    ],
  };
}

function firstMatch(text: string, re: RegExp): string {
  return text.match(re)?.[0]?.trim() ?? "";
}

function uniq(arr: string[]): string[] {
  return [...new Set(arr.map((s) => s.replace(/[.,)]+$/, "")))];
}
