import { callLLM, hasLLM, parseJson } from "./llm.js";

interface GenerateInput {
  title: string;
  company: string;
  requirements: string[];
  deadline: string | null; // ISO date
}

export interface GeneratedTask {
  label: string;
  dueDate: string | null; // ISO date
}

/**
 * Turns an application's requirements + deadline into an actionable checklist.
 * Uses the configured LLM (Gemini/Claude) when available; rule-based fallback otherwise.
 */
export async function generateTasks(
  input: GenerateInput,
): Promise<GeneratedTask[]> {
  if (hasLLM()) {
    try {
      return await generateWithLLM(input);
    } catch (err) {
      console.warn(
        "AI task gen failed, using fallback:",
        (err as Error).message,
      );
    }
  }
  return generateWithRules(input);
}

async function generateWithLLM(
  input: GenerateInput,
): Promise<GeneratedTask[]> {
  const raw = await callLLM(
    `Create a concise, actionable application to-do checklist for this role. Respond with ONLY a JSON array, no markdown fences:

[{ "label": string (imperative, e.g. "Tailor resume to highlight React"), "dueDate": string | null (ISO YYYY-MM-DD) }]

Rules:
- 4–8 tasks. Each a single clear action the applicant takes.
- Cover preparing materials the role/form requires, plus a final "Submit application" task.
- If a deadline is given, set the submit task's dueDate to it and space earlier tasks before it. Otherwise dueDate null.

Role: ${input.title} at ${input.company}
Deadline: ${input.deadline ?? "none stated"}
Requirements:
${input.requirements.map((r) => `- ${r}`).join("\n") || "- (none captured)"}`,
  );
  const parsed = parseJson<GeneratedTask[]>(raw);
  return parsed.filter((t) => t && typeof t.label === "string").slice(0, 10);
}

/** Rule-based fallback: derive tasks from requirements + standard steps. */
function generateWithRules(input: GenerateInput): GeneratedTask[] {
  const tasks: { label: string }[] = [];

  // Always: tailor resume
  tasks.push({ label: `Tailor resume for ${input.company}` });

  // One task per requirement (cleaned), capped
  for (const req of input.requirements.slice(0, 6)) {
    const cleaned = req.replace(/^Provide:\s*/i, "").replace(/\s*\(required\)/i, "").trim();
    if (!cleaned) continue;
    // Don't prepend a verb if the requirement already starts with one
    const startsWithVerb = /^(write|draft|create|prepare|update|tailor|submit|get|upload|build|complete|review)\b/i.test(cleaned);
    let label: string;
    if (startsWithVerb) {
      label = cleaned;
    } else if (/resume|cv/i.test(cleaned)) {
      label = `Prepare ${cleaned}`;
    } else if (/letter|essay|statement|portfolio|cover/i.test(cleaned)) {
      label = `Write ${cleaned}`;
    } else {
      label = `Prepare: ${cleaned}`;
    }
    tasks.push({ label: label.slice(0, 120) });
  }

  // Final submit task
  tasks.push({ label: "Submit application" });

  // Spread due dates evenly between now and the deadline (submit = deadline)
  const deadline = input.deadline ? new Date(input.deadline) : null;
  const n = tasks.length;
  return tasks.map((t, i) => {
    let dueDate: string | null = null;
    if (deadline && !Number.isNaN(deadline.getTime())) {
      const now = Date.now();
      const span = deadline.getTime() - now;
      const frac = n === 1 ? 1 : i / (n - 1);
      dueDate = new Date(now + span * frac).toISOString().slice(0, 10);
    }
    return { label: t.label, dueDate };
  });
}
