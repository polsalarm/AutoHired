/**
 * Thin wrappers over the browser Web Speech API — text-to-speech (the
 * interviewer's voice) and speech-to-text (the candidate's answers).
 * No backend/keys. Best support in Chrome/Edge; callers should feature-detect
 * and offer a typed fallback elsewhere.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export function ttsSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function speak(text: string, onEnd?: () => void): void {
  if (!ttsSupported() || !text) {
    onEnd?.();
    return;
  }
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 1;
  u.pitch = 1;
  u.lang = "en-US";
  if (onEnd) u.onend = () => onEnd();
  window.speechSynthesis.speak(u);
}

export function stopSpeaking(): void {
  if (ttsSupported()) window.speechSynthesis.cancel();
}

function getRecognitionCtor(): any {
  if (typeof window === "undefined") return null;
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function sttSupported(): boolean {
  return getRecognitionCtor() !== null;
}

/** Prompts for / verifies microphone access. Returns false if blocked. */
export async function requestMic(): Promise<boolean> {
  try {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      return false;
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    return true;
  } catch {
    return false;
  }
}

export interface Recognizer {
  start: () => void;
  stop: () => void;
  abort: () => void;
}

/**
 * Creates a continuous recognizer. `onResult` fires with the running transcript
 * (interim + final) so the UI can show live text; `onEnd` fires when it stops.
 */
export function createRecognizer(handlers: {
  onResult: (text: string) => void;
  onEnd: () => void;
  onError?: (error: string) => void;
}): Recognizer | null {
  const Ctor = getRecognitionCtor();
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.lang = "en-US";
  rec.continuous = true;
  rec.interimResults = true;

  let finalText = "";
  rec.onresult = (e: any) => {
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) finalText += r[0].transcript + " ";
      else interim += r[0].transcript;
    }
    handlers.onResult((finalText + interim).trim());
  };
  rec.onerror = (e: any) => handlers.onError?.(e?.error ?? "speech-error");
  rec.onend = () => handlers.onEnd();

  return {
    start() {
      finalText = "";
      try {
        rec.start();
      } catch {
        /* already started */
      }
    },
    stop() {
      try {
        rec.stop();
      } catch {
        /* not running */
      }
    },
    abort() {
      try {
        rec.abort();
      } catch {
        /* not running */
      }
    },
  };
}
