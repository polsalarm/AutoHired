import { useState } from "react";
import { Icon } from "./Icon";
import { VoiceInterview } from "./VoiceInterview";
import { generateInterviewQuestions } from "../api";
import type { InterviewQuestion } from "../types";

const CATEGORY_STYLE: Record<string, { label: string; cls: string }> = {
  behavioral: { label: "Behavioral", cls: "bg-primary-fixed text-primary" },
  technical: { label: "Technical", cls: "bg-tertiary-fixed text-tertiary" },
  role: { label: "Role", cls: "bg-secondary-fixed text-secondary" },
  situational: { label: "Situational", cls: "bg-surface-container text-on-surface-variant" },
  company: { label: "Company", cls: "bg-error-container text-on-error-container" },
};

function categoryStyle(c: string) {
  return CATEGORY_STYLE[c] ?? CATEGORY_STYLE.role;
}

export function InterviewPractice({
  appInfo,
  userId,
}: {
  appInfo: {
    title: string;
    company: string;
    requirements: string[];
    description: string;
  };
  userId: string | undefined;
}) {
  const [mode, setMode] = useState<"choose" | "text" | "voice">("choose");
  const [questions, setQuestions] = useState<InterviewQuestion[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());

  if (mode === "voice") {
    return (
      <VoiceInterview
        appInfo={appInfo}
        userId={userId}
        onExit={() => setMode("choose")}
      />
    );
  }

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const qs = await generateInterviewQuestions(userId, appInfo);
      setQuestions(qs);
      setRevealed(new Set());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function toggle(i: number) {
    setRevealed((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  return (
    <section className="bg-surface-container-lowest rounded-xl p-container-margin shadow-level-1 border border-surface-container">
      <div className="flex items-center gap-3 mb-1">
        <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center shrink-0">
          <Icon name="forum" fill size={18} />
        </div>
        <div className="flex-1">
          <h3 className="text-body-lg font-semibold text-on-surface">Interview Practice</h3>
          <p className="text-label-sm text-on-surface-variant">
            Questions tailored to this role and your profile
          </p>
        </div>
        {mode === "text" && !loading && (
          <button
            onClick={() => {
              setMode("choose");
              setQuestions(null);
              setError(null);
            }}
            aria-label="Back to interview options"
            className="w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-colors shrink-0"
          >
            <Icon name="arrow_back" size={18} />
          </button>
        )}
        {questions && !loading && (
          <button
            onClick={generate}
            className="text-label-md text-primary hover:bg-primary-fixed rounded-lg px-3 py-1.5 transition-colors flex items-center gap-1 shrink-0"
          >
            <Icon name="refresh" size={16} />
            Regenerate
          </button>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-2 py-8 text-on-surface-variant">
          <Icon name="sync" className="animate-spin" size={18} />
          <span className="text-body-md">Preparing your questions…</span>
        </div>
      )}

      {error && !loading && (
        <p className="text-body-md text-error py-4 flex items-center gap-2">
          <Icon name="error" size={18} />
          {error}
        </p>
      )}

      {mode === "choose" && (
        <div className="mt-stack-md grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={() => setMode("voice")}
            className="bg-primary text-on-primary rounded-xl p-4 text-left shadow-level-1 hover:bg-on-primary-fixed-variant active:scale-95 transition-all flex flex-col gap-1"
          >
            <span className="flex items-center gap-2 text-label-md font-semibold">
              <Icon name="mic" fill size={18} />
              Voice interview
            </span>
            <span className="text-label-sm opacity-90">
              Spoken AI mock + live feedback & scorecard
            </span>
          </button>
          <button
            onClick={() => {
              setMode("text");
              generate();
            }}
            className="bg-surface border border-outline-variant/40 text-on-surface rounded-xl p-4 text-left hover:bg-surface-container-low active:scale-95 transition-all flex flex-col gap-1"
          >
            <span className="flex items-center gap-2 text-label-md font-semibold">
              <Icon name="quiz" size={18} />
              Practice questions
            </span>
            <span className="text-label-sm text-on-surface-variant">
              Read at your own pace, with model answers
            </span>
          </button>
        </div>
      )}

      {questions && !loading && questions.length === 0 && (
        <p className="text-body-md text-on-surface-variant py-4">
          No questions generated — try regenerating.
        </p>
      )}

      {questions && questions.length > 0 && !loading && (
        <ul className="flex flex-col gap-stack-md mt-stack-md">
          {questions.map((q, i) => {
            const cat = categoryStyle(q.category);
            const open = revealed.has(i);
            return (
              <li
                key={i}
                className="rounded-xl border border-outline-variant/20 bg-surface p-4 flex flex-col gap-3"
              >
                <div className="flex items-start gap-3">
                  <span className="text-label-sm text-on-surface-variant font-bold tabular-nums mt-0.5">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className={`inline-block text-label-sm rounded-full px-2 py-0.5 mb-1.5 ${cat.cls}`}>
                      {cat.label}
                    </span>
                    <p className="text-body-md text-on-surface font-medium">{q.question}</p>
                  </div>
                </div>

                <button
                  onClick={() => toggle(i)}
                  className="self-start text-label-md text-primary hover:bg-primary-fixed rounded-lg px-2 py-1 transition-colors flex items-center gap-1"
                >
                  <Icon name={open ? "visibility_off" : "lightbulb"} size={16} />
                  {open ? "Hide guidance" : "Show tip & model answer"}
                </button>

                {open && (
                  <div className="flex flex-col gap-3 pl-1 border-l-2 border-primary-fixed ml-1">
                    {q.tip && (
                      <div className="pl-3">
                        <p className="text-label-sm text-secondary uppercase tracking-wide mb-0.5">Tip</p>
                        <p className="text-body-md text-on-surface-variant">{q.tip}</p>
                      </div>
                    )}
                    {q.sampleAnswer && (
                      <div className="pl-3">
                        <p className="text-label-sm text-primary uppercase tracking-wide mb-0.5">Model answer</p>
                        <p className="text-body-md text-on-surface-variant whitespace-pre-line">
                          {q.sampleAnswer}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
