import type {
  InterviewPrepResult,
  InterviewQA,
  InterviewQuestion,
  InterviewScorecard,
  InterviewTurnResult,
} from "../types.js";
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

// ---------- Live (voice) mock interview ----------

interface TurnInput extends PrepInput {
  history: InterviewQA[];
  maxQuestions?: number;
}

/**
 * Drives one turn of a conversational mock interview: react to the candidate's
 * last answer and ask the next question, or — once enough have been asked —
 * return a final scorecard. Stateless; the client passes the full history each turn.
 */
export async function interviewTurn(input: TurnInput): Promise<InterviewTurnResult> {
  const max = input.maxQuestions ?? 5;
  const finished = input.history.length >= max;

  if (finished) {
    if (hasLLM()) {
      try {
        return await evaluateWithLLM(input);
      } catch (err) {
        console.warn("AI interview eval failed, using fallback:", (err as Error).message);
      }
    }
    return evaluateFallback(input);
  }

  if (hasLLM()) {
    try {
      return await nextWithLLM(input);
    } catch (err) {
      console.warn("AI interview turn failed, using fallback:", (err as Error).message);
    }
  }
  return nextFallback(input);
}

function transcript(history: InterviewQA[]): string {
  if (history.length === 0) return "(no questions asked yet)";
  return history
    .map((qa, i) => `Q${i + 1}: ${qa.question}\nA${i + 1}: ${qa.answer || "(no answer)"}`)
    .join("\n\n");
}

async function nextWithLLM(input: TurnInput): Promise<InterviewTurnResult> {
  const { title, company, requirements, description, profile, history } = input;
  const profileBlock = profile?.trim() ? `\n\nCandidate profile:\n${profile.slice(0, 2_000)}` : "";
  const raw = await callLLM(
    `You are a friendly but rigorous interviewer conducting a live mock interview for the role below. Based on the transcript so far, give brief constructive feedback on the candidate's MOST RECENT answer (empty string if none yet), then ask the NEXT question. Ask ONE question, conversational, spoken aloud — tailor it to the role, requirements, profile, and build naturally on their previous answers. Respond with ONLY JSON, no markdown fences:

{ "feedback": string (1-2 sentences on the last answer, or ""), "nextQuestion": string (the next question to ask) }

Role: ${title} at ${company}
Role summary: ${description.slice(0, 1_200)}
Key requirements:
${requirements.map((r) => `- ${r}`).join("\n") || "- (none captured)"}${profileBlock}

Transcript so far:
${transcript(history)}`,
    { maxTokens: 3_000 },
  );
  const parsed = parseJson<{ feedback?: string; nextQuestion?: string }>(raw);
  const nextQuestion =
    typeof parsed.nextQuestion === "string" && parsed.nextQuestion.trim()
      ? parsed.nextQuestion.trim()
      : nextFallback(input).nextQuestion;
  return {
    feedback: typeof parsed.feedback === "string" ? parsed.feedback.trim() : "",
    nextQuestion,
    done: false,
    scorecard: null,
  };
}

async function evaluateWithLLM(input: TurnInput): Promise<InterviewTurnResult> {
  const { title, company, history } = input;
  const raw = await callLLM(
    `You are an interviewer scoring a completed mock interview for ${title} at ${company}. Evaluate the candidate from the full transcript. Be fair and specific. Respond with ONLY JSON, no markdown fences:

{ "overall": number (0-100), "verdict": string (2-3 words, e.g. "Strong Candidate"), "summary": string (2-3 sentences of overall assessment), "strengths": string[] (2-4 things they did well), "improvements": string[] (2-4 concrete things to work on) }

Transcript:
${transcript(history)}`,
    { maxTokens: 3_000 },
  );
  const parsed = parseJson<Partial<InterviewScorecard>>(raw);
  return { feedback: "", nextQuestion: null, done: true, scorecard: normalizeScorecard(parsed) };
}

function normalizeScorecard(p: Partial<InterviewScorecard>): InterviewScorecard {
  const overall = clampScore(p.overall);
  return {
    overall,
    verdict: typeof p.verdict === "string" && p.verdict.trim() ? p.verdict.trim() : verdictForScore(overall),
    summary: typeof p.summary === "string" ? p.summary.trim() : "",
    strengths: strArr(p.strengths),
    improvements: strArr(p.improvements),
  };
}

/** Offline next-question fallback: walk the template questions by index. */
function nextFallback(input: TurnInput): InterviewTurnResult {
  const pool = prepWithTemplate(input).questions;
  const q = pool[input.history.length % pool.length];
  return {
    feedback: input.history.length === 0 ? "" : "Good — be specific and back it up with a concrete example.",
    nextQuestion: q.question,
    done: false,
    scorecard: null,
  };
}

/** Offline scorecard fallback: rough heuristic from answer fullness. */
function evaluateFallback(input: TurnInput): InterviewTurnResult {
  const answers = input.history.filter((qa) => qa.answer.trim());
  const avgWords =
    answers.reduce((n, qa) => n + qa.answer.trim().split(/\s+/).length, 0) /
    (answers.length || 1);
  const overall = clampScore(40 + Math.min(40, avgWords * 1.5) + answers.length * 4);
  return {
    feedback: "",
    nextQuestion: null,
    done: true,
    scorecard: {
      overall,
      verdict: verdictForScore(overall),
      summary: `You answered ${answers.length} of ${input.history.length} questions. (Heuristic estimate — connect an AI provider for a detailed evaluation.)`,
      strengths: answers.length ? ["Completed the interview", "Engaged with each question"] : [],
      improvements: ["Use the STAR format", "Add specific, quantified examples", "Tie answers back to the role"],
    },
  };
}

function verdictForScore(score: number): string {
  if (score >= 85) return "Strong Candidate";
  if (score >= 70) return "Promising";
  if (score >= 50) return "Needs Polish";
  return "Keep Practicing";
}

function strArr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((s): s is string => typeof s === "string") : [];
}

function clampScore(n: unknown): number {
  const x = Math.round(Number(n));
  if (Number.isNaN(x)) return 0;
  return Math.max(0, Math.min(100, x));
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
