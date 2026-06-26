import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import {
  getProfileText,
  interviewTurn,
  type InterviewScorecard,
  type ScorecardMetrics,
} from "../api";
import {
  createRecognizer,
  requestMic,
  speak,
  sttSupported,
  stopSpeaking,
  ttsSupported,
  type Recognizer,
} from "../lib/speech";

type Status =
  | "intro"
  | "loading"
  | "asking"
  | "listening"
  | "thinking"
  | "done"
  | "error";

interface QA {
  question: string;
  answer: string;
}

const MAX_Q = 5;

export function VoiceInterview({
  appInfo,
  userId,
  onExit,
}: {
  appInfo: {
    title: string;
    company: string;
    requirements: string[];
    description: string;
  };
  userId: string | undefined;
  onExit: () => void;
}) {
  const [status, setStatus] = useState<Status>("intro");
  const [question, setQuestion] = useState("");
  const [transcript, setTranscript] = useState("");
  const [feedback, setFeedback] = useState("");
  const [history, setHistory] = useState<QA[]>([]);
  const [scorecard, setScorecard] = useState<InterviewScorecard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [micError, setMicError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);

  const profileRef = useRef("");
  const recRef = useRef<Recognizer | null>(null);
  const listeningRef = useRef(false);
  const mutedRef = useRef(false);
  mutedRef.current = muted;

  // Cleanup voice on unmount.
  useEffect(() => {
    return () => {
      listeningRef.current = false;
      stopSpeaking();
      recRef.current?.abort();
    };
  }, []);

  // Lock body scroll while the immersive overlay is open.
  const immersive =
    status === "asking" ||
    status === "listening" ||
    status === "thinking" ||
    status === "done";
  useEffect(() => {
    if (!immersive) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [immersive]);

  function ensureRecognizer(): Recognizer | null {
    if (recRef.current) return recRef.current;
    recRef.current = createRecognizer({
      onResult: (text) => setTranscript(text),
      onEnd: () => {
        // Chrome ends recognition after a short silence — keep it going until
        // the user submits their answer.
        if (listeningRef.current) {
          try {
            recRef.current?.start();
          } catch {
            /* ignore */
          }
        }
      },
      onError: (code) => {
        if (code === "not-allowed" || code === "service-not-allowed") {
          listeningRef.current = false;
          setMicError("Microphone blocked. Allow mic access in your browser (or just type your answer below).");
        } else if (code === "audio-capture") {
          listeningRef.current = false;
          setMicError("No microphone detected. Type your answer below.");
        }
        // 'no-speech' / 'network' → ignore; onEnd will restart listening.
      },
    });
    return recRef.current;
  }

  function ask(q: string) {
    setQuestion(q);
    setTranscript("");
    setStatus("asking");
    if (ttsSupported() && !mutedRef.current) {
      speak(q, () => beginListening());
    } else {
      beginListening();
    }
  }

  async function beginListening() {
    setStatus("listening");
    setMicError(null);
    if (!sttSupported()) {
      // No speech recognition in this browser — the user types instead.
      setMicError("Voice input isn't supported in this browser — type your answer below. (Chrome/Edge recommended.)");
      return;
    }
    const ok = await requestMic();
    if (!ok) {
      setMicError("Microphone blocked or unavailable. Allow mic access, or type your answer below.");
      return;
    }
    listeningRef.current = true;
    ensureRecognizer()?.start();
  }

  function pauseListening() {
    listeningRef.current = false;
    recRef.current?.stop();
    setStatus("asking");
  }

  async function start() {
    setStatus("loading");
    setError(null);
    try {
      profileRef.current = await getProfileText(userId);
      const turn = await interviewTurn(appInfo, [], profileRef.current, MAX_Q);
      if (turn.nextQuestion) ask(turn.nextQuestion);
      else throw new Error("No question returned");
    } catch (e) {
      setError((e as Error).message);
      setStatus("error");
    }
  }

  async function submitAnswer() {
    listeningRef.current = false;
    recRef.current?.stop();
    stopSpeaking();
    const answer = transcript.trim();
    const nextHistory = [...history, { question, answer }];
    setHistory(nextHistory);
    setStatus("thinking");
    try {
      const turn = await interviewTurn(appInfo, nextHistory, profileRef.current, MAX_Q);
      if (turn.done && turn.scorecard) {
        finish(turn.scorecard);
      } else if (turn.nextQuestion) {
        setFeedback(turn.feedback);
        ask(turn.nextQuestion);
      } else {
        endNow(nextHistory);
      }
    } catch (e) {
      setError((e as Error).message);
      setStatus("error");
    }
  }

  function finish(card: InterviewScorecard) {
    listeningRef.current = false;
    recRef.current?.abort();
    stopSpeaking();
    setScorecard(card);
    setStatus("done");
  }

  /** End early: force an evaluation from whatever has been answered. */
  async function endNow(hist: QA[] = history) {
    listeningRef.current = false;
    recRef.current?.stop();
    stopSpeaking();
    setStatus("thinking");
    try {
      const turn = await interviewTurn(
        appInfo,
        hist,
        profileRef.current,
        Math.max(1, hist.length),
      );
      finish(
        turn.scorecard ?? {
          overall: 0,
          verdict: "Incomplete",
          summary: "Not enough answers to evaluate.",
          metrics: { communication: 0, relevance: 0, confidence: 0, structure: 0 },
          strengths: [],
          improvements: [],
          detailed: [],
        },
      );
    } catch (e) {
      setError((e as Error).message);
      setStatus("error");
    }
  }

  function exit() {
    listeningRef.current = false;
    stopSpeaking();
    recRef.current?.abort();
    onExit();
  }

  function retry() {
    setHistory([]);
    setFeedback("");
    setScorecard(null);
    setTranscript("");
    start();
  }

  const qNumber = history.length + 1;
  const voiceOk = ttsSupported() || sttSupported();

  // ---------- Inline card: intro / loading / error ----------
  if (!immersive) {
    return (
      <section className="bg-surface-container-lowest rounded-xl p-container-margin shadow-level-1 border border-surface-container flex flex-col gap-stack-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center shrink-0">
            <Icon name="mic" fill size={18} />
          </div>
          <div className="flex-1">
            <h3 className="text-body-lg font-semibold text-on-surface">AI Voice Interview</h3>
            <p className="text-label-sm text-on-surface-variant">
              {appInfo.title} @ {appInfo.company}
            </p>
          </div>
          <button
            onClick={exit}
            aria-label="Close"
            className="w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-colors"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        {status === "intro" && (
          <div className="flex flex-col gap-stack-md">
            <p className="text-body-md text-on-surface-variant">
              A {MAX_Q}-question mock interview. I'll ask out loud — answer by voice
              (or type). You'll get feedback as we go and a scorecard at the end.
            </p>
            {!voiceOk && (
              <p className="text-label-md text-error flex items-center gap-2">
                <Icon name="info" size={16} />
                Voice isn't supported here — you can still type your answers. (Chrome/Edge recommended.)
              </p>
            )}
            <button
              onClick={start}
              className="w-full bg-primary text-on-primary text-label-md py-3 rounded-lg shadow-level-1 hover:bg-on-primary-fixed-variant active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <Icon name="play_arrow" size={20} />
              Start interview
            </button>
          </div>
        )}

        {status === "loading" && <Busy label="Connecting your interviewer…" />}

        {status === "error" && (
          <div className="flex flex-col gap-3">
            <p className="text-body-md text-error flex items-center gap-2">
              <Icon name="error" size={18} />
              {error}
            </p>
            <button
              onClick={start}
              className="self-start text-label-md text-primary hover:bg-primary-fixed rounded-lg px-3 py-1.5 transition-colors"
            >
              Try again
            </button>
          </div>
        )}
      </section>
    );
  }

  // ---------- Immersive full-screen overlay ----------
  return (
    <div className="fixed inset-0 z-[70] bg-surface flex flex-col overscroll-none">
      {/* Top bar */}
      <header className="shrink-0 flex items-center justify-between px-container-margin h-14 border-b border-outline-variant/10">
        {status !== "done" ? (
          <button
            onClick={() => setMuted((m) => !m)}
            aria-label={muted ? "Unmute interviewer" : "Mute interviewer"}
            className="w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-colors"
          >
            <Icon name={muted ? "volume_off" : "volume_up"} size={20} />
          </button>
        ) : (
          <span className="w-9" />
        )}
        <span className="text-body-lg font-bold text-primary tracking-tight">AutoHired</span>
        <button
          onClick={exit}
          aria-label="Close interview"
          className="w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-colors"
        >
          <Icon name="close" size={20} />
        </button>
      </header>

      {status === "done" && scorecard ? (
        <Scorecard card={scorecard} role={appInfo} onRetry={retry} onExit={exit} />
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain flex flex-col items-center px-container-margin py-stack-lg max-w-lg mx-auto w-full">
          {/* Progress */}
          <div className="w-full">
            <p className="text-center text-label-sm text-on-surface-variant uppercase tracking-[0.15em] font-semibold mb-2">
              Question {Math.min(qNumber, MAX_Q)} of {MAX_Q}
            </p>
            <div className="h-1.5 w-full rounded-full bg-surface-container-high overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${(Math.min(history.length, MAX_Q) / MAX_Q) * 100}%` }}
              />
            </div>
          </div>

          {/* Question */}
          <h2 className="mt-stack-lg text-center text-headline-lg-mobile font-bold text-on-surface leading-tight">
            {question}
          </h2>

          {feedback && status !== "thinking" && (
            <div className="mt-stack-md w-full bg-secondary-fixed/40 rounded-xl px-4 py-3 flex items-start gap-2">
              <Icon name="reviews" size={16} className="text-secondary mt-0.5 shrink-0" />
              <p className="text-label-md text-on-surface-variant">{feedback}</p>
            </div>
          )}

          {/* Mic orb */}
          <div className="flex-1 flex flex-col items-center justify-center py-stack-lg min-h-[180px]">
            {status === "thinking" ? (
              <div className="flex flex-col items-center gap-4">
                <div className="w-28 h-28 rounded-full bg-primary-container flex items-center justify-center">
                  <Icon name="sync" size={40} className="animate-spin text-on-primary-container" />
                </div>
                <span className="text-label-md text-on-surface-variant">Interviewer is thinking…</span>
              </div>
            ) : (
              <>
                <button
                  onClick={status === "listening" ? pauseListening : beginListening}
                  aria-label={status === "listening" ? "Pause listening" : "Start answering"}
                  className="relative w-28 h-28 rounded-full flex items-center justify-center transition-transform active:scale-95"
                >
                  {status === "listening" && (
                    <>
                      <span className="absolute inset-0 rounded-full bg-primary/30 animate-ping" />
                      <span className="absolute -inset-3 rounded-full bg-primary/10 animate-pulse" />
                    </>
                  )}
                  <span className="relative w-full h-full rounded-full bg-primary text-on-primary flex items-center justify-center shadow-level-2">
                    <Icon name="mic" fill size={44} />
                  </span>
                </button>
                <div className="mt-5 h-6 flex items-center">
                  {status === "listening" && !micError ? (
                    <span className="flex items-center gap-2 text-primary font-semibold text-label-md uppercase tracking-wider">
                      <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                      Listening…
                    </span>
                  ) : (
                    <span className="text-label-md text-on-surface-variant">
                      Tap the mic to answer
                    </span>
                  )}
                </div>
              </>
            )}
          </div>

          {micError && (
            <p className="text-label-md text-error flex items-start gap-2 mb-3 w-full">
              <Icon name="mic_off" size={16} className="mt-0.5 shrink-0" />
              {micError}
            </p>
          )}

          {/* Transcript + controls */}
          {status !== "thinking" && (
            <div className="w-full flex flex-col gap-3">
              <textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder={
                  status === "listening"
                    ? "Your words appear here — or type instead."
                    : "Type your answer, or tap the mic above."
                }
                rows={3}
                className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl p-3 text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={submitAnswer}
                  disabled={!transcript.trim()}
                  className="flex-1 bg-primary text-on-primary text-label-md py-3 rounded-xl shadow-level-1 hover:bg-on-primary-fixed-variant active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  <Icon name="send" size={18} />
                  Submit answer
                </button>
                <button
                  onClick={() => speak(question)}
                  aria-label="Repeat question"
                  className="w-12 h-12 shrink-0 rounded-xl flex items-center justify-center text-on-surface-variant border border-outline-variant/30 hover:bg-surface-container transition-colors"
                >
                  <Icon name="replay" size={20} />
                </button>
              </div>
              <button
                onClick={() => endNow()}
                className="self-center text-label-md text-on-surface-variant hover:text-on-surface px-3 py-1.5 transition-colors"
              >
                End &amp; see scorecard
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Busy({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-6 text-on-surface-variant">
      <Icon name="sync" className="animate-spin" size={18} />
      <span className="text-body-md">{label}</span>
    </div>
  );
}

const METRIC_META: {
  key: keyof ScorecardMetrics;
  label: string;
  bar: string;
}[] = [
  { key: "communication", label: "Communication", bar: "bg-primary" },
  { key: "relevance", label: "Relevance", bar: "bg-tertiary" },
  { key: "confidence", label: "Confidence", bar: "bg-secondary" },
  { key: "structure", label: "Structure", bar: "bg-error" },
];

function Scorecard({
  card,
  role,
  onRetry,
  onExit,
}: {
  card: InterviewScorecard;
  role: { title: string; company: string };
  onRetry: () => void;
  onExit: () => void;
}) {
  const circ = 2 * Math.PI * 45;
  return (
    <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain max-w-lg mx-auto w-full px-container-margin py-stack-lg flex flex-col gap-stack-lg">
      <div className="text-center">
        <h1 className="text-headline-lg-mobile font-bold text-on-surface">Interview Results</h1>
        <p className="text-label-md text-on-surface-variant mt-1">
          {role.title} · {role.company}
        </p>
      </div>

      {/* Overall gauge */}
      <div className="flex flex-col items-center gap-3 bg-surface-container-low rounded-2xl p-stack-lg">
        <span className="text-label-sm text-on-surface-variant uppercase tracking-[0.15em] font-semibold">
          Overall Performance
        </span>
        <div className="relative w-40 h-40">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="45" fill="transparent" stroke="currentColor" className="text-surface-container-high" strokeWidth="9" />
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="transparent"
              className="text-primary"
              stroke="currentColor"
              strokeWidth="9"
              strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={circ * (1 - card.overall / 100)}
              style={{ transition: "stroke-dashoffset 0.8s ease-out" }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[2.75rem] font-bold text-on-surface tabular-nums">{card.overall}</span>
          </div>
        </div>
        <span className="bg-primary-fixed text-primary text-label-md font-semibold rounded-full px-4 py-1.5">
          {card.verdict}
        </span>
        {card.summary && (
          <p className="text-center text-body-md text-on-surface-variant mt-1">{card.summary}</p>
        )}
      </div>

      {/* Sub-metrics */}
      <div className="grid grid-cols-2 gap-x-stack-md gap-y-stack-md">
        {METRIC_META.map((m) => {
          const v = card.metrics?.[m.key] ?? card.overall;
          return (
            <div key={m.key} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between">
                <span className="text-label-sm text-on-surface-variant uppercase tracking-wide">{m.label}</span>
                <span className="text-label-md font-bold text-on-surface tabular-nums">{v}</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-surface-container-high overflow-hidden">
                <div
                  className={`h-full rounded-full ${m.bar}`}
                  style={{ width: `${v}%`, transition: "width 0.8s ease-out" }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Strengths */}
      {card.strengths.length > 0 && (
        <div>
          <h4 className="text-label-md text-secondary font-semibold mb-2 flex items-center gap-1.5">
            <Icon name="trending_up" size={18} /> Strengths
          </h4>
          <ul className="space-y-2">
            {card.strengths.map((s) => (
              <li key={s} className="text-body-md text-on-surface-variant flex items-start gap-2">
                <Icon name="check_circle" fill size={16} className="text-secondary mt-0.5 shrink-0" />
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Areas to improve */}
      {card.improvements.length > 0 && (
        <div>
          <h4 className="text-label-md text-error font-semibold mb-2 flex items-center gap-1.5">
            <Icon name="lightbulb" size={18} /> Areas to Improve
          </h4>
          <ul className="space-y-2">
            {card.improvements.map((s) => (
              <li key={s} className="text-body-md text-on-surface-variant flex items-start gap-2">
                <Icon name="chevron_right" size={16} className="text-error mt-0.5 shrink-0" />
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Per-question detailed feedback */}
      {card.detailed?.length > 0 && (
        <div>
          <h4 className="text-label-md text-on-surface font-semibold mb-2 flex items-center gap-1.5">
            <Icon name="forum" size={18} /> Detailed Feedback
          </h4>
          <div className="flex flex-col gap-2.5">
            {card.detailed.map((d, i) => (
              <div key={i} className="bg-surface-container-low rounded-xl p-3.5">
                <p className="text-label-md font-medium text-on-surface">{d.question}</p>
                {d.feedback && (
                  <p className="text-body-md text-on-surface-variant mt-1">{d.feedback}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-2 pt-1">
        <button
          onClick={onRetry}
          className="w-full bg-primary text-on-primary text-label-md py-3 rounded-xl shadow-level-1 hover:bg-on-primary-fixed-variant active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          <Icon name="refresh" size={18} />
          Practice Again
        </button>
        <button
          onClick={onExit}
          className="w-full text-label-md text-on-surface-variant hover:bg-surface-container rounded-xl py-3 transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  );
}
