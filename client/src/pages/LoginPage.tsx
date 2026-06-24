import { useState } from "react";
import { Icon } from "../components/Icon";
import { useAuth } from "../auth/AuthContext";

export function LoginPage() {
  const { signInWithPassword, signUp } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "signin") {
        await signInWithPassword(email, password);
      } else {
        await signUp(email, password, name);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col justify-center px-container-margin max-w-md mx-auto w-full">
      <div className="flex flex-col items-center mb-stack-lg">
        <div className="w-16 h-16 rounded-xl bg-primary flex items-center justify-center mb-stack-md shadow-level-2">
          <Icon name="work" fill size={32} className="text-on-primary" />
        </div>
        <h1 className="text-headline-lg-mobile text-primary">AutoHired</h1>
        <p className="text-body-md text-on-surface-variant mt-1 text-center">
          {mode === "signin"
            ? "Sign in to track your applications"
            : "Create an account to get started"}
        </p>
      </div>

      <form
        onSubmit={submit}
        className="flex flex-col gap-stack-md bg-surface-container-lowest rounded-xl p-container-margin shadow-level-1 border border-outline-variant/30"
      >
        {mode === "signup" && (
          <label className="flex flex-col gap-1">
            <span className="text-label-md text-on-surface-variant">Name</span>
            <input
              className="bg-surface-container-low rounded-lg px-4 h-12 text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
            />
          </label>
        )}
        <label className="flex flex-col gap-1">
          <span className="text-label-md text-on-surface-variant">Email</span>
          <input
            type="email"
            className="bg-surface-container-low rounded-lg px-4 h-12 text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-label-md text-on-surface-variant">Password</span>
          <input
            type="password"
            className="bg-surface-container-low rounded-lg px-4 h-12 text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
          />
        </label>

        {error && (
          <p className="text-label-md text-error bg-error-container/40 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="bg-primary text-on-primary h-12 rounded-lg text-label-md shadow-level-1 hover:bg-on-primary-fixed-variant transition-colors active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {busy && <Icon name="sync" size={18} className="animate-spin" />}
          {mode === "signin" ? "Sign In" : "Create Account"}
        </button>
      </form>

      <button
        onClick={() => {
          setMode(mode === "signin" ? "signup" : "signin");
          setError(null);
        }}
        className="text-label-md text-primary mt-stack-md text-center hover:underline"
      >
        {mode === "signin"
          ? "Need an account? Sign up"
          : "Already have an account? Sign in"}
      </button>
    </main>
  );
}
