import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Icon } from "../components/Icon";
import { useAuth } from "../auth/AuthContext";
import { createApplicationManual, generateAndSaveTasks } from "../api";

/**
 * Manual application entry — the fallback when a URL can't be scraped
 * (LinkedIn/Workday block bots) or the user wants to add a posting by hand.
 * Pre-fills the URL from ?url= when redirected from a failed scrape.
 */
export function NewApplicationPage() {
  const { user, demoMode } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [url, setUrl] = useState(params.get("url") ?? "");
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [requirements, setRequirements] = useState("");
  const [deadline, setDeadline] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (demoMode || !user) {
      setError("Demo mode: configure Supabase to save applications.");
      return;
    }
    setBusy(true);
    try {
      const reqs = requirements
        .split("\n")
        .map((r) => r.trim())
        .filter(Boolean);
      const saved = await createApplicationManual(user.id, {
        url,
        title,
        company,
        location: location || null,
        description,
        requirements: reqs,
        deadline: deadline || null,
      });
      generateAndSaveTasks(user.id, {
        id: saved.id,
        title: saved.title,
        company: saved.company,
        requirements: saved.requirements,
        deadline: saved.deadline,
      }).catch((e) => console.warn("Task auto-gen failed:", e.message));
      navigate(`/applications/${saved.id}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const field =
    "bg-surface-container-low rounded-lg px-4 h-12 text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary w-full";

  return (
    <div className="flex flex-col items-center">
      <header className="sticky top-0 w-full z-40 bg-surface/90 backdrop-blur-md flex justify-between items-center h-16 px-container-margin">
        <Link
          to="/"
          className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-surface-container transition-colors text-on-surface-variant active:opacity-70"
          aria-label="Back"
        >
          <Icon name="arrow_back" />
        </Link>
        <h1 className="flex-1 text-center text-label-md text-on-surface pr-10">
          Add Application
        </h1>
      </header>

      <form
        onSubmit={submit}
        className="w-full max-w-2xl px-container-margin mt-stack-md flex flex-col gap-stack-md pb-stack-xl"
      >
        <label className="flex flex-col gap-1">
          <span className="text-label-md text-on-surface-variant">Posting URL</span>
          <input type="url" className={field} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-stack-md">
          <label className="flex flex-col gap-1">
            <span className="text-label-md text-on-surface-variant">Role title *</span>
            <input className={field} value={title} onChange={(e) => setTitle(e.target.value)} required />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-label-md text-on-surface-variant">Company *</span>
            <input className={field} value={company} onChange={(e) => setCompany(e.target.value)} required />
          </label>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-stack-md">
          <label className="flex flex-col gap-1">
            <span className="text-label-md text-on-surface-variant">Location</span>
            <input className={field} value={location} onChange={(e) => setLocation(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-label-md text-on-surface-variant">Deadline</span>
            <input type="date" className={field} value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </label>
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-label-md text-on-surface-variant">Description</span>
          <textarea
            className="bg-surface-container-low rounded-lg px-4 py-3 text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary w-full min-h-[100px]"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-label-md text-on-surface-variant">
            Requirements (one per line)
          </span>
          <textarea
            className="bg-surface-container-low rounded-lg px-4 py-3 text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary w-full min-h-[120px]"
            value={requirements}
            onChange={(e) => setRequirements(e.target.value)}
            placeholder={"Strong React experience\nFamiliarity with TypeScript"}
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
          Save Application
        </button>
      </form>
    </div>
  );
}
