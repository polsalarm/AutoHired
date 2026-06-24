import type { InterviewPrepResult, InterviewQuestion } from "../types.js";
import { callLLM, hasLLM, parseJson } from "./llm.js";

interface PrepInput {
  title: string;
  company: string;
  requirements: string[];
  description: string;
  profile?: string;
}

/**
 * Generates interview-practice questions tailored to a specific application
 * (role + requirements) and the applicant's own profile. Uses the configured
 * LLM when available; falls back to a template generator offline.
 */
export async function generateInterviewQuestions(
  input: PrepInput,
): Promise<InterviewPrepResult> {
  if (hasLLM()) {
    try {
      return await prepWithLLM(input);
    } catch (err) {
      console.warn("AI interview prep failed, using fallback:", (err as Error).message);
    }
  }
  return prepWithTemplate(input);
}

async function prepWithLLM(input: PrepInput): Promise<InterviewPrepResult> {
  const { title, company, requirements, description, profile } = input;
  const profileBlock = profile?.trim()
    ? `\n\nApplicant profile (tailor questions and sample answers to THIS person — probe their stated strengths and likely gaps):\n${profile.slice(0, 3_000)}`
    : "";
  const raw = await callLLM(
    `You are an interview coach preparing a candidate for a SPECIFIC role. Generate 6-8 realistic interview questions they are likely to be asked, tailored to the role, its requirements, and the applicant's background. Mix categories: behavioral, technical/role-specific, situational, and one about motivation/company fit. Respond with ONLY a JSON object, no markdown fences:

{ "questions": [ { "question": string, "category": "behavioral" | "technical" | "role" | "situational" | "company", "tip": string (1 sentence — what the interviewer is really assessing / how to approach it), "sampleAnswer": string (2-4 sentences, a strong answer framed around this applicant's background) } ] }

Role: ${title} at ${company}
Role summary: ${description.slice(0, 1_500)}
Key requirements:
${requirements.map((r) => `- ${r}`).join("\n") || "- (none captured)"}${profileBlock}`,
    { maxTokens: 6_000 },
  );
  const parsed = parseJson<{ questions?: Partial<InterviewQuestion>[] }>(raw);
  const questions = (parsed.questions ?? [])
    .filter((q) => q && typeof q.question === "string" && q.question.trim())
    .map((q) => ({
      question: String(q.question).trim(),
      category: normalizeCategory(q.category),
      tip: typeof q.tip === "string" ? q.tip.trim() : "",
      sampleAnswer: typeof q.sampleAnswer === "string" ? q.sampleAnswer.trim() : "",
    }));
  if (questions.length === 0) return prepWithTemplate(input);
  return { questions };
}

const CATEGORIES = new Set(["behavioral", "technical", "role", "situational", "company"]);

function normalizeCategory(c: unknown): string {
  const v = String(c ?? "").toLowerCase().trim();
  return CATEGORIES.has(v) ? v : "role";
}

/** Offline fallback: template questions seeded from the role + requirements. */
function prepWithTemplate(input: PrepInput): InterviewPrepResult {
  const { title, company, requirements } = input;
  const role = title || "this role";
  const org = company || "the company";
  const questions: InterviewQuestion[] = [
    {
      question: `Walk me through your background and why you're interested in the ${role} role at ${org}.`,
      category: "behavioral",
      tip: "Keep it to 90 seconds; connect your story directly to this role.",
      sampleAnswer: "Summarize your most relevant experience, then state one specific reason this role and company excite you.",
    },
    {
      question: "Tell me about a challenging project you worked on and how you handled obstacles.",
      category: "behavioral",
      tip: "Use the STAR format — Situation, Task, Action, Result — and quantify the result.",
      sampleAnswer: "Pick a project with a measurable outcome and emphasize the actions you personally took.",
    },
    {
      question: `Why ${org}, and why now?`,
      category: "company",
      tip: "Show you researched the company's mission, product, or recent work.",
      sampleAnswer: "Name something specific about the company and tie it to your goals.",
    },
  ];

  for (const req of requirements.slice(0, 4)) {
    const cleaned = req.replace(/^Provide:\s*/i, "").replace(/\s*\(required\)/i, "").trim();
    if (!cleaned) continue;
    questions.push({
      question: `This role calls for: "${cleaned}". Can you walk me through your experience with that?`,
      category: "role",
      tip: "Give a concrete example; if you lack direct experience, show how you'd ramp up quickly.",
      sampleAnswer: "Describe a specific instance demonstrating this skill, or the closest transferable experience you have.",
    });
  }

  questions.push({
    question: "Where do you see yourself growing in this position, and what questions do you have for us?",
    category: "situational",
    tip: "Always prepare 2-3 thoughtful questions for the interviewer.",
    sampleAnswer: "Mention a growth area aligned with the role, then ask about the team, success metrics, or onboarding.",
  });

  return { questions };
}
