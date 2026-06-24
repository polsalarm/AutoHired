import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import {
  getProfileText,
  interviewTurn,
  type InterviewScorecard,
} from "../api";
import {
  createRecognizer,
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
  const [muted, setMuted] = useState(false);

  const profileRef = useRef("");
  const recRef = useRef<Recognizer | null>(null);
  const mutedRef = useRef(false);
  mutedRef.current = muted;

  // Cleanup voice on unmount.
  useEffect(() => {
    return () => {
      stopSpeaking();
      recRef.current?.abort();
    };
  }, []);

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

  function beginListening() {
    setStatus("listening");
    if (!recRef.current) {
      recRef.current = createRecognizer({
        onResult: (text) => setTranscript(text),
        onEnd: () => {
          /* stopped — submit is manual */
        },
        onError: () => {
          /* ignore; user can type instead */
        },
      });
    }
    recRef.current?.start();
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
    recRef.current?.abort();
    stopSpeaking();
    setScorecard(card);
    setStatus("done");
  }

  /** End early: force an evaluation from whatever has been answered. */
  async function endNow(hist: QA[] = history) {
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
          strengths: [],
          improvements: [],
        },
      );
    } catch (e) {
      setError((e as Error).message);
      setStatus("error");
    }
  }

  const qNumber = history.length + 1;
  const voiceOk = ttsSupported() || sttSupported();

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
        {status !== "intro" && status !== "done" && (
          <button
            onClick={() => setMuted((m) => !m)}
            aria-label={muted ? "Unmute interviewer" : "Mute interviewer"}
            className="w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-colors"
          >
            <Icon name={muted ? "volume_off" : "volume_up"} size={18} />
          </button>
        )}
        <button
          onClick={() => {
            stopSpeaking();
            recRef.current?.abort();
            onExit();
          }}
          aria-label="Close"
          className="w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-colors"
        >
          <Icon name="close" size={18} />
        </button>
      </div>

      {/* Intro */}
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

      {status === "loading" && (
        <Busy label="Connecting your interviewer…" />
      )}

      {/* Active interview */}
      {(status === "asking" || status === "listening" || status === "thinking") && (
        <div className="flex flex-col gap-stack-md">
          <div className="flex items-center justify-between">
            <span className="text-label-sm text-on-surface-variant uppercase tracking-wider">
              Question {Math.min(qNumber, MAX_Q)} of {MAX_Q}
            </span>
            <div className="flex gap-1">
              {Array.from({ length: MAX_Q }).map((_, i) => (
                <span
                  key={i}
                  className={`w-2 h-2 rounded-full ${
                    i < history.length
                      ? "bg-primary"
                      : i === history.length
                        ? "bg-primary/50"
                        : "bg-surface-container-high"
                  }`}
                />
              ))}
            </div>
          </div>

          {feedback && (
            <div className="bg-secondary-fixed/40 rounded-lg p-3 flex items-start gap-2">
              <Icon name="reviews" size={16} className="text-secondary mt-0.5 shrink-0" />
              <p className="text-label-md text-on-surface-variant">{feedback}</p>
            </div>
          )}

          <div className="bg-primary-container text-on-primary-container rounded-xl p-4 flex items-start gap-3">
            <Icon name="person_raised_hand" fill size={22} className="shrink-0 mt-0.5" />
            <p className="text-body-lg font-medium">{question}</p>
          </div>

          {status === "thinking" ? (
            <Busy label="Interviewer is thinking…" />
          ) : (
            <>
              <div className="relative">
                <textarea
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  placeholder={
                    status === "listening"
                      ? "Listening… speak your answer (or type)."
                      : "Your answer…"
                  }
                  rows={4}
                  className="w-full bg-surface border border-outline-variant/40 rounded-lg p-3 pr-10 text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
                {status === "listening" && (
                  <span className="absolute top-3 right-3 flex items-center gap-1.5 text-error">
                    <span className="w-2.5 h-2.5 rounded-full bg-error animate-pulse" />
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {status === "asking" && (
                  <button
                    onClick={beginListening}
                    className="flex-1 bg-primary text-on-primary text-label-md py-2.5 rounded-lg hover:bg-on-primary-fixed-variant active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <Icon name="mic" size={18} />
                    Answer now
                  </button>
                )}
                {status === "listening" && (
                  <button
                    onClick={submitAnswer}
                    disabled={!transcript.trim()}
                    className="flex-1 bg-primary text-on-primary text-label-md py-2.5 rounded-lg hover:bg-on-primary-fixed-variant active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Icon name="send" size={18} />
                    Submit answer
                  </button>
                )}
                <button
                  onClick={() => speak(question)}
                  aria-label="Repeat question"
                  className="w-11 h-11 shrink-0 rounded-lg flex items-center justify-center text-on-surface-variant border border-outline-variant/40 hover:bg-surface-container transition-colors"
                >
                  <Icon name="replay" size={18} />
                </button>
                <button
                  onClick={() => endNow()}
                  className="text-label-md text-on-surface-variant hover:bg-surface-container rounded-lg px-3 py-2.5 transition-colors shrink-0"
                >
                  End
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Scorecard */}
      {status === "done" && scorecard && (
        <Scorecard card={scorecard} onRetry={() => {
          setHistory([]);
          setFeedback("");
          setScorecard(null);
          setTranscript("");
          start();
        }} />
      )}

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

function Busy({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-6 text-on-surface-variant">
      <Icon name="sync" className="animate-spin" size={18} />
      <span className="text-body-md">{label}</span>
    </div>
  );
}

function Scorecard({
  card,
  onRetry,
}: {
  card: InterviewScorecard;
  onRetry: () => void;
}) {
  const circ = 2 * Math.PI * 45;
  return (
    <div className="flex flex-col gap-stack-md">
      <div className="bg-primary-container text-on-primary-container rounded-xl p-container-margin flex items-center gap-gutter relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
        <div className="relative w-20 h-20 shrink-0">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="45" fill="transparent" stroke="rgba(255,255,255,0.2)" strokeWidth="8" />
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="transparent"
              stroke="currentColor"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={circ * (1 - card.overall / 100)}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-label-md font-bold">{card.overall}%</span>
          </div>
        </div>
        <div className="flex-1 z-10">
          <h3 className="text-body-lg font-bold mb-1">{card.verdict}</h3>
          <p className="text-body-md opacity-90">{card.summary}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-stack-md">
        {card.strengths.length > 0 && (
          <div>
            <h4 className="text-label-md text-secondary font-semibold mb-2 flex items-center gap-1">
              <Icon name="trending_up" size={18} /> Strengths
            </h4>
            <ul className="space-y-1.5">
              {card.strengths.map((s) => (
                <li key={s} className="text-label-md text-on-surface-variant flex items-start gap-2">
                  <Icon name="add" size={16} className="text-secondary mt-0.5 shrink-0" />
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}
        {card.improvements.length > 0 && (
          <div>
            <h4 className="text-label-md text-error font-semibold mb-2 flex items-center gap-1">
              <Icon name="fitness_center" size={18} /> Work on
            </h4>
            <ul className="space-y-1.5">
              {card.improvements.map((s) => (
                <li key={s} className="text-label-md text-on-surface-variant flex items-start gap-2">
                  <Icon name="chevron_right" size={16} className="text-error mt-0.5 shrink-0" />
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <button
        onClick={onRetry}
        className="self-start text-label-md text-primary hover:bg-primary-fixed rounded-lg px-3 py-2 transition-colors flex items-center gap-1"
      >
        <Icon name="refresh" size={16} />
        Practice again
      </button>
    </div>
  );
}
