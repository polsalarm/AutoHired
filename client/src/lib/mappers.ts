import type {
  AIAnalysis,
  Application,
  TaskItem,
  VaultDocument,
} from "../types";

/** Maps snake_case DB rows → camelCase domain types. */

type Row = Record<string, unknown>;

export function toApplication(r: Row): Application {
  return {
    id: r.id as string,
    userId: r.user_id as string,
    url: r.url as string,
    title: r.title as string,
    company: r.company as string,
    location: (r.location as string) ?? null,
    description: (r.description as string) ?? "",
    requirements: (r.requirements as string[]) ?? [],
    deadline: (r.deadline as string) ?? null,
    status: r.status as Application["status"],
    matchScore: (r.match_score as number) ?? null,
    createdAt: r.created_at as string,
  };
}

export function toTask(r: Row): TaskItem {
  return {
    id: r.id as string,
    applicationId: r.application_id as string,
    label: r.label as string,
    dueDate: (r.due_date as string) ?? null,
    done: Boolean(r.done),
    source: r.source as TaskItem["source"],
  };
}

export function toDocument(r: Row): VaultDocument {
  return {
    id: r.id as string,
    userId: r.user_id as string,
    name: r.name as string,
    type: r.type as VaultDocument["type"],
    storagePath: r.storage_path as string,
    parsedText: (r.parsed_text as string) ?? null,
    status: r.status as VaultDocument["status"],
    addedAt: r.added_at as string,
  };
}

export function toAnalysis(r: Row): AIAnalysis {
  return {
    id: r.id as string,
    applicationId: r.application_id as string,
    documentId: r.document_id as string,
    matchScore: r.match_score as number,
    verdict: r.verdict as string,
    summary: r.summary as string,
    suggestions: (r.suggestions as string[]) ?? [],
    gaps: (r.gaps as string[]) ?? [],
    strengths: (r.strengths as string[]) ?? [],
    createdAt: r.created_at as string,
  };
}
