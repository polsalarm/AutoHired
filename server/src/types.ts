/**
 * Core domain types — mirrored in client/src/types.ts. Keep in sync.
 */

export interface ScrapedJob {
  url: string;
  title: string;
  company: string;
  location: string | null;
  description: string;
  requirements: string[];
  deadline: string | null; // ISO date
}

export interface AIAnalysisResult {
  matchScore: number; // 0–100
  verdict: string;
  summary: string;
  suggestions: string[];
  gaps: string[];
  strengths: string[];
}

export interface InterviewQuestion {
  question: string;
  category: string; // behavioral | technical | role | company | situational
  tip: string; // what the interviewer is looking for / how to approach it
  sampleAnswer: string; // a model answer framed around this applicant
}

export interface InterviewPrepResult {
  questions: InterviewQuestion[];
}

export interface InterviewQA {
  question: string;
  answer: string;
}

/** Per-dimension interview sub-scores, each 0–100. */
export interface ScorecardMetrics {
  communication: number;
  relevance: number;
  confidence: number;
  structure: number;
}

/** Specific feedback tied to one answered question. */
export interface ScorecardDetail {
  question: string;
  feedback: string;
}

export interface InterviewScorecard {
  overall: number; // 0–100
  verdict: string; // 2-3 words
  summary: string;
  metrics: ScorecardMetrics; // communication / relevance / confidence / structure
  strengths: string[];
  improvements: string[];
  detailed: ScorecardDetail[]; // per-question notes
}

/** One turn of a live (voice) mock interview. */
export interface InterviewTurnResult {
  feedback: string; // brief reaction to the last answer ("" on the first turn)
  nextQuestion: string | null; // null once the interview is done
  done: boolean;
  scorecard: InterviewScorecard | null; // present only when done
}

// ---------- Tailored resume + cover letter ----------

/** One job in a tailored resume. */
export interface ResumeExperience {
  role: string;
  company: string;
  location: string;
  period: string; // freeform, e.g. "2021 – Present"
  bullets: string[]; // achievement bullets, rewritten for this role
}

/** One education entry. */
export interface ResumeEducation {
  degree: string;
  institution: string;
  period: string;
  detail: string; // honors, GPA, relevant coursework — may be empty
}

/** A resume rewritten to target one specific application. */
export interface TailoredResume {
  name: string;
  headline: string; // target-role title line
  contact: {
    email: string;
    phone: string;
    location: string;
    links: string[]; // portfolio / LinkedIn / GitHub URLs
  };
  summary: string; // 2-4 sentence professional summary tuned to the role
  skills: string[];
  experience: ResumeExperience[];
  education: ResumeEducation[];
}

/** A cover letter written for one specific application. */
export interface CoverLetter {
  greeting: string; // e.g. "Dear Hiring Manager,"
  body: string[]; // 3-4 paragraphs
  closing: string; // e.g. "Sincerely,"
  signature: string; // applicant name
}

/** Result of tailoring a resume + cover letter to an application. */
export interface ResumeTailorResult {
  resume: TailoredResume;
  coverLetter: CoverLetter;
  changelog: string[]; // plain-language list of what was changed for THIS role
}
