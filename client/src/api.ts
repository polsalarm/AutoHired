import { db } from "./lib/supabase";
import { apiUrl } from "./lib/apiBase";
import {
  toApplication,
  toAnalysis,
  toDocument,
  toEvent,
  toTask,
} from "./lib/mappers";
import type {
  AIAnalysis,
  Application,
  DocumentType,
  EventType,
  InterviewQuestion,
  ProfileStats,
  ScheduleEvent,
  ScrapedJob,
  TaskItem,
  VaultDocument,
} from "./types";

/** Thin data-access layer over Supabase. RLS scopes every query to the user. */

// ---------- Profile ----------

export interface Profile {
  id: string;
  name: string;
  headline: string;
  summary: string;
  skills: string;
  experience: string;
  education: string;
  location: string;
  links: string;
}

export async function getProfile(userId: string): Promise<Profile> {
  const { data, error } = await db()
    .from("profiles")
    .select("id, name, headline, summary, skills, experience, education, location, links")
    .eq("id", userId)
    .single();
  if (error) throw error;
  return {
    id: data.id,
    name: data.name ?? "",
    headline: data.headline ?? "",
    summary: data.summary ?? "",
    skills: data.skills ?? "",
    experience: data.experience ?? "",
    education: data.education ?? "",
    location: data.location ?? "",
    links: data.links ?? "",
  };
}

type ProfileFields = Exclude<keyof Profile, "id">;

export async function updateProfile(
  userId: string,
  patch: Partial<Pick<Profile, ProfileFields>>,
): Promise<void> {
  const { error } = await db().from("profiles").update(patch).eq("id", userId);
  if (error) throw error;
}

export interface LinkItem {
  label: string;
  url: string;
}

/** Parses the `links` column (JSON array of {label,url}; tolerates legacy plain text). */
export function parseLinks(raw: string): LinkItem[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    if (Array.isArray(v)) {
      return v
        .filter((x) => x && typeof x.url === "string")
        .map((x) => ({ label: String(x.label ?? ""), url: String(x.url) }));
    }
  } catch {
    // Legacy freeform: split on newlines/commas into unlabeled URLs.
  }
  return raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((url) => ({ label: "", url }));
}

/** Serializes a link list back into the `links` column (empty string when none). */
export function serializeLinks(items: LinkItem[]): string {
  const clean = items
    .map((i) => ({ label: i.label.trim(), url: i.url.trim() }))
    .filter((i) => i.url);
  return clean.length ? JSON.stringify(clean) : "";
}

/** Flattens a profile into a labeled text block for AI prompts (empty fields skipped). */
export function profileToText(p: Partial<Profile>): string {
  const parts: string[] = [];
  if (p.headline) parts.push(`Headline: ${p.headline}`);
  if (p.location) parts.push(`Location: ${p.location}`);
  if (p.summary) parts.push(`Summary: ${p.summary}`);
  if (p.skills) parts.push(`Skills: ${p.skills}`);
  if (p.experience) parts.push(`Experience: ${p.experience}`);
  if (p.education) parts.push(`Education: ${p.education}`);
  if (p.links) {
    const ls = parseLinks(p.links);
    if (ls.length) {
      parts.push(
        `Links: ${ls
          .map((l) => (l.label ? `${l.label}: ${l.url}` : l.url))
          .join(", ")}`,
      );
    }
  }
  return parts.join("\n");
}

// ---------- Applications ----------

export async function listApplications(): Promise<Application[]> {
  const { data, error } = await db()
    .from("applications")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(toApplication);
}

export async function getApplication(id: string): Promise<Application | null> {
  const { data, error } = await db()
    .from("applications")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? toApplication(data) : null;
}

export async function createApplicationFromScrape(
  userId: string,
  job: ScrapedJob,
): Promise<Application> {
  const { data, error } = await db()
    .from("applications")
    .insert({
      user_id: userId,
      url: job.url,
      title: job.title,
      company: job.company,
      location: job.location,
      description: job.description,
      requirements: job.requirements,
      deadline: job.deadline,
      status: "draft",
    })
    .select("*")
    .single();
  if (error) throw error;
  return toApplication(data);
}

export interface ManualApplicationInput {
  url: string;
  title: string;
  company: string;
  location: string | null;
  description: string;
  requirements: string[];
  deadline: string | null;
}

/** Create an application from manually-entered data (scrape fallback). */
export async function createApplicationManual(
  userId: string,
  input: ManualApplicationInput,
): Promise<Application> {
  const { data, error } = await db()
    .from("applications")
    .insert({
      user_id: userId,
      url: input.url || "",
      title: input.title,
      company: input.company,
      location: input.location,
      description: input.description,
      requirements: input.requirements,
      deadline: input.deadline,
      status: "draft",
    })
    .select("*")
    .single();
  if (error) throw error;
  return toApplication(data);
}

export async function updateApplicationStatus(
  id: string,
  status: Application["status"],
): Promise<void> {
  const { error } = await db()
    .from("applications")
    .update({ status })
    .eq("id", id);
  if (error) throw error;
}

export async function updateApplicationDeadline(
  id: string,
  deadline: string | null,
): Promise<void> {
  const { error } = await db()
    .from("applications")
    .update({ deadline })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteApplication(id: string): Promise<void> {
  const { error } = await db().from("applications").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Tasks ----------

export async function listTasks(): Promise<TaskItem[]> {
  const { data, error } = await db()
    .from("tasks")
    .select("*")
    .order("due_date", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(toTask);
}

export async function listTasksForApplication(
  applicationId: string,
): Promise<TaskItem[]> {
  const { data, error } = await db()
    .from("tasks")
    .select("*")
    .eq("application_id", applicationId)
    .order("due_date", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(toTask);
}

export async function setTaskDone(id: string, done: boolean): Promise<void> {
  const { error } = await db().from("tasks").update({ done }).eq("id", id);
  if (error) throw error;
}

export async function addTask(
  userId: string,
  applicationId: string,
  label: string,
  dueDate: string | null,
): Promise<TaskItem> {
  const { data, error } = await db()
    .from("tasks")
    .insert({
      user_id: userId,
      application_id: applicationId,
      label,
      due_date: dueDate,
      source: "manual",
    })
    .select("*")
    .single();
  if (error) throw error;
  return toTask(data);
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await db().from("tasks").delete().eq("id", id);
  if (error) throw error;
}

interface GeneratedTask {
  label: string;
  dueDate: string | null;
}

/** Calls the server to generate a checklist, then bulk-inserts into Supabase. */
export async function generateAndSaveTasks(
  userId: string,
  app: {
    id: string;
    title: string;
    company: string;
    requirements: string[];
    deadline: string | null;
  },
): Promise<TaskItem[]> {
  const res = await fetch(apiUrl("/api/tasks/generate"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: app.title,
      company: app.company,
      requirements: app.requirements,
      deadline: app.deadline,
    }),
  });
  if (!res.ok) throw new Error(`Task generation failed (${res.status})`);
  const { tasks } = (await res.json()) as { tasks: GeneratedTask[] };
  if (tasks.length === 0) return [];

  const rows = tasks.map((t) => ({
    user_id: userId,
    application_id: app.id,
    label: t.label,
    due_date: t.dueDate,
    source: "ai" as const,
  }));
  const { data, error } = await db().from("tasks").insert(rows).select("*");
  if (error) throw error;
  return (data ?? []).map(toTask);
}

// ---------- Documents ----------

export async function listDocuments(): Promise<VaultDocument[]> {
  const { data, error } = await db()
    .from("documents")
    .select("*")
    .order("added_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(toDocument);
}

/** Sends a file to the server, returns extracted plain text. */
export async function extractText(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(apiUrl("/api/extract"), { method: "POST", body: fd });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Extraction failed (${res.status})`);
  }
  const { text } = (await res.json()) as { text: string };
  return text;
}

export async function uploadDocument(
  userId: string,
  file: File,
  type: DocumentType,
  parsedText: string | null = null,
): Promise<VaultDocument> {
  const path = `${userId}/${Date.now()}_${file.name}`;
  const { error: upErr } = await db()
    .storage.from("documents")
    .upload(path, file, { upsert: false });
  if (upErr) throw upErr;

  const hasText = Boolean(parsedText && parsedText.trim().length >= 20);
  const { data, error } = await db()
    .from("documents")
    .insert({
      user_id: userId,
      name: file.name,
      type,
      storage_path: path,
      parsed_text: parsedText,
      status: hasText ? "analyzed" : "pending",
    })
    .select("*")
    .single();
  if (error) throw error;
  return toDocument(data);
}

/** Extracts text on the server, uploads the file, inserts the row. */
export async function uploadAndExtract(
  userId: string,
  file: File,
  type: DocumentType,
): Promise<VaultDocument> {
  let text: string | null = null;
  try {
    text = await extractText(file);
  } catch (err) {
    // Non-fatal: store the file even if extraction fails (e.g. scanned PDF)
    console.warn("Text extraction failed:", (err as Error).message);
  }
  return uploadDocument(userId, file, type, text);
}

export async function getDocumentUrl(storagePath: string): Promise<string> {
  const { data, error } = await db()
    .storage.from("documents")
    .createSignedUrl(storagePath, 60);
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteDocument(
  id: string,
  storagePath: string,
): Promise<void> {
  await db().storage.from("documents").remove([storagePath]);
  const { error } = await db().from("documents").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Analyses ----------

interface AnalysisResult {
  matchScore: number;
  verdict: string;
  summary: string;
  suggestions: string[];
  gaps: string[];
  strengths: string[];
}

/**
 * Runs a resume × application match on the server, persists the result to
 * `analyses` (upsert per app+doc pair), and stamps the application match_score.
 */
export async function analyzeAndSave(
  userId: string,
  app: {
    id: string;
    title: string;
    company: string;
    requirements: string[];
    description: string;
  },
  doc: { id: string; parsedText: string | null },
): Promise<AIAnalysis> {
  if (!doc.parsedText || doc.parsedText.trim().length < 20) {
    throw new Error("This document has no extracted text to analyze.");
  }
  // Pull the candidate's profile so the AI weighs it alongside the resume.
  let profile = "";
  try {
    profile = profileToText(await getProfile(userId));
  } catch {
    // Non-fatal: analyze on the resume alone if the profile can't be read.
  }
  const res = await fetch(apiUrl("/api/analyze"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: app.title,
      company: app.company,
      requirements: app.requirements,
      description: app.description,
      resumeText: doc.parsedText,
      profile,
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Analysis failed (${res.status})`);
  }
  const result = (await res.json()) as AnalysisResult;

  const { data, error } = await db()
    .from("analyses")
    .upsert(
      {
        user_id: userId,
        application_id: app.id,
        document_id: doc.id,
        match_score: result.matchScore,
        verdict: result.verdict,
        summary: result.summary,
        suggestions: result.suggestions,
        gaps: result.gaps,
        strengths: result.strengths,
      },
      { onConflict: "application_id,document_id" },
    )
    .select("*")
    .single();
  if (error) throw error;

  // Stamp the application so dashboard/profile reflect the score.
  await db()
    .from("applications")
    .update({ match_score: result.matchScore })
    .eq("id", app.id);

  return toAnalysis(data);
}

export async function getAnalysisForApplication(
  applicationId: string,
): Promise<AIAnalysis | null> {
  const { data, error } = await db()
    .from("analyses")
    .select("*")
    .eq("application_id", applicationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? toAnalysis(data) : null;
}

// ---------- Interview practice ----------

/**
 * Asks the server for interview questions tailored to an application and the
 * user's profile. Stateless — questions are not persisted.
 */
export async function generateInterviewQuestions(
  userId: string | undefined,
  app: {
    title: string;
    company: string;
    requirements: string[];
    description: string;
  },
): Promise<InterviewQuestion[]> {
  // Fold in the profile so questions probe the candidate's real background.
  let profile = "";
  if (userId) {
    try {
      profile = profileToText(await getProfile(userId));
    } catch {
      // Non-fatal: generate from the role alone if the profile can't be read.
    }
  }
  const res = await fetch(apiUrl("/api/interview/questions"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: app.title,
      company: app.company,
      requirements: app.requirements,
      description: app.description,
      profile,
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Interview prep failed (${res.status})`);
  }
  const { questions } = (await res.json()) as { questions: InterviewQuestion[] };
  return questions ?? [];
}

export interface InterviewScorecard {
  overall: number;
  verdict: string;
  summary: string;
  strengths: string[];
  improvements: string[];
}

export interface InterviewTurn {
  feedback: string;
  nextQuestion: string | null;
  done: boolean;
  scorecard: InterviewScorecard | null;
}

/**
 * One turn of a live (voice) mock interview. Pass the full Q&A history each
 * call; the server reacts to the last answer and asks the next question, or
 * returns a scorecard once enough have been asked. `profile` is resolved once
 * by the caller to avoid re-fetching every turn.
 */
export async function interviewTurn(
  app: {
    title: string;
    company: string;
    requirements: string[];
    description: string;
  },
  history: { question: string; answer: string }[],
  profile: string,
  maxQuestions = 5,
): Promise<InterviewTurn> {
  const res = await fetch(apiUrl("/api/interview/turn"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: app.title,
      company: app.company,
      requirements: app.requirements,
      description: app.description,
      profile,
      history,
      maxQuestions,
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Interview turn failed (${res.status})`);
  }
  return (await res.json()) as InterviewTurn;
}

/** Resolves a user's profile into the labeled text block AI routes expect. */
export async function getProfileText(userId: string | undefined): Promise<string> {
  if (!userId) return "";
  try {
    return profileToText(await getProfile(userId));
  } catch {
    return "";
  }
}

// ---------- Schedule events ----------

export interface EventInput {
  type: EventType;
  title: string;
  startsAt: string; // ISO timestamp
  location: string | null;
  notes: string | null;
  applicationId: string | null;
}

export async function listEvents(): Promise<ScheduleEvent[]> {
  const { data, error } = await db()
    .from("events")
    .select("*")
    .order("starts_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(toEvent);
}

export async function createEvent(
  userId: string,
  input: EventInput,
): Promise<ScheduleEvent> {
  const { data, error } = await db()
    .from("events")
    .insert({
      user_id: userId,
      application_id: input.applicationId,
      type: input.type,
      title: input.title,
      starts_at: input.startsAt,
      location: input.location,
      notes: input.notes,
    })
    .select("*")
    .single();
  if (error) throw error;
  return toEvent(data);
}

export async function setEventDone(id: string, done: boolean): Promise<void> {
  const { error } = await db().from("events").update({ done }).eq("id", id);
  if (error) throw error;
}

export async function deleteEvent(id: string): Promise<void> {
  const { error } = await db().from("events").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Derived profile stats ----------

export function computeStats(apps: Application[]): ProfileStats {
  const sent = apps.filter((a) => a.status !== "draft").length;
  const interviews = apps.filter((a) =>
    ["interviewing", "offer"].includes(a.status),
  ).length;
  const scored = apps.filter((a) => a.matchScore !== null);
  const avg =
    scored.length === 0
      ? 0
      : Math.round(
          scored.reduce((sum, a) => sum + (a.matchScore ?? 0), 0) /
            scored.length,
        );
  return {
    applicationsSent: sent,
    interviewsSecured: interviews,
    avgMatchScore: avg,
  };
}
