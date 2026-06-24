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

export interface InterviewScorecard {
  overall: number; // 0–100
  verdict: string; // 2-3 words
  summary: string;
  strengths: string[];
  improvements: string[];
}

/** One turn of a live (voice) mock interview. */
export interface InterviewTurnResult {
  feedback: string; // brief reaction to the last answer ("" on the first turn)
  nextQuestion: string | null; // null once the interview is done
  done: boolean;
  scorecard: InterviewScorecard | null; // present only when done
}
