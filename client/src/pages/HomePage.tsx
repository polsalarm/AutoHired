import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Icon } from "../components/Icon";
import { Avatar } from "../components/Avatar";
import { ProgressRing } from "../components/ProgressRing";
import { StatusChip } from "../components/StatusChip";
import { EmptyState, ErrorState, SkeletonList } from "../components/states";
import { useAuth } from "../auth/AuthContext";
import { useApplications } from "../hooks/useData";
import { createApplicationFromScrape, generateAndSaveTasks } from "../api";
import { apiUrl } from "../lib/apiBase";
import type { ScrapedJob } from "../types";

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86_400_000));
}

export function HomePage() {
  const { user, demoMode } = useAuth();
  const { data: applications, loading, error, reload } = useApplications();
  const navigate = useNavigate();

  const [url, setUrl] = useState("");
  const [scraping, setScraping] = useState(false);
  const [scrapeError, setScrapeError] = useState<string | null>(null);

  async function handleScrape() {
    if (!url.trim()) return;
    setScraping(true);
    setScrapeError(null);
    try {
      const res = await fetch(apiUrl("/api/scrape"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Scrape failed (${res.status})`);
      }
      const job = (await res.json()) as ScrapedJob;
      setUrl("");
      if (!demoMode && user) {
        const saved = await createApplicationFromScrape(user.id, job);
        // Auto-generate the checklist (non-blocking — detail page can also do it)
        generateAndSaveTasks(user.id, {
          id: saved.id,
          title: saved.title,
          company: saved.company,
          requirements: saved.requirements,
          deadline: saved.deadline,
        }).catch((e) => console.warn("Task auto-gen failed:", e.message));
        reload();
        navigate(`/applications/${saved.id}`);
      } else {
        // Demo mode: nowhere to persist — surface the parsed result.
        console.log("Scraped (demo):", job);
        setScrapeError("Demo mode: scraped but not saved. Configure Supabase to persist.");
      }
    } catch (err) {
      setScrapeError((err as Error).message);
    } finally {
      setScraping(false);
    }
  }

  const apps = applications ?? [];

  return (
    <main className="pb-stack-lg flex flex-col gap-stack-lg">
      {/* Gradient hero: greeting + AI quick-add */}
      <section className="relative overflow-hidden rounded-b-3xl px-container-margin pt-stack-md pb-stack-lg">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary-container to-secondary-container" />
        <div className="absolute -right-12 -top-12 w-48 h-48 bg-white/15 rounded-full blur-3xl" />
        <div className="absolute -left-10 bottom-0 w-36 h-36 bg-tertiary-fixed/30 rounded-full blur-3xl" />

        <div className="relative">
          <h1 className="text-headline-lg-mobile text-white font-bold tracking-tight drop-shadow-sm">
            Hello{user?.user_metadata?.name ? `, ${user.user_metadata.name.split(" ")[0]}` : ""}!
          </h1>
          <p className="text-body-md text-white/85 mt-1">
            {apps.length} Application{apps.length === 1 ? "" : "s"} in progress
          </p>

          {/* Glassy quick-add */}
          <div className="mt-stack-md relative bg-white/95 backdrop-blur rounded-2xl shadow-level-2 p-unit flex items-center border border-white/40">
            <input
              className="flex-1 bg-transparent border-none text-body-md text-on-surface placeholder:text-outline focus:outline-none px-gutter h-10"
              placeholder="Paste a job link — AI does the rest..."
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleScrape()}
            />
            <button
              onClick={handleScrape}
              disabled={scraping}
              className="bg-primary text-on-primary rounded-xl px-gutter h-10 flex items-center gap-2 shadow-level-1 hover:bg-on-primary-fixed-variant transition-colors active:scale-95 shrink-0 disabled:opacity-50"
            >
              <Icon name={scraping ? "sync" : "auto_fix_high"} size={18} className={scraping ? "animate-spin" : ""} />
              <span className="text-label-md hidden sm:inline">Scrape</span>
            </button>
          </div>
          {scrapeError && (
            <div className="flex items-center justify-between gap-2 px-gutter mt-2">
              <p className="text-label-md text-white">{scrapeError}</p>
              <Link
                to={`/applications/new${url ? `?url=${encodeURIComponent(url)}` : ""}`}
                className="text-label-md text-white font-semibold whitespace-nowrap hover:underline shrink-0"
              >
                Enter manually
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Active Applications */}
      <div className="px-container-margin flex flex-col gap-stack-md">
        {loading && <SkeletonList />}
        {error && <ErrorState message={error} />}
        {!loading && !error && apps.length === 0 && (
          <div className="flex flex-col items-center gap-stack-md">
            <EmptyState
              icon="work_history"
              title="No active applications"
              hint="Paste a link above to start tracking your next career move."
            />
            <Link
              to="/applications/new"
              className="text-label-md text-primary hover:underline flex items-center gap-1"
            >
              <Icon name="edit_note" size={18} />
              Add one manually
            </Link>
          </div>
        )}
        {apps.map((app) => {
          const days = daysUntil(app.deadline);
          return (
            <Link
              key={app.id}
              to={`/applications/${app.id}`}
              className="bg-surface-container-lowest rounded-xl shadow-level-1 p-container-margin flex items-center gap-gutter overflow-hidden group"
            >
              <Avatar label={app.company} size={48} rounded="rounded-lg" />
              <div className="flex-1 min-w-0 flex flex-col gap-1">
                <h3 className="text-label-md text-on-surface truncate">{app.title}</h3>
                <p className="text-label-sm text-on-surface-variant truncate">
                  {app.company}
                </p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <StatusChip status={app.status} />
                  {days !== null && (
                    <span
                      className={`px-2 py-1 rounded-full text-label-sm inline-flex items-center gap-1 ${
                        days <= 3
                          ? "bg-error-container text-on-error-container"
                          : "bg-secondary-container text-on-secondary-container"
                      }`}
                    >
                      <Icon name="schedule" size={14} />
                      {days} days
                    </span>
                  )}
                </div>
              </div>
              {app.matchScore !== null && (
                <div className="shrink-0 flex flex-col items-center gap-1">
                  <ProgressRing value={app.matchScore} size={52} />
                  <span className="text-label-sm text-on-surface-variant">match</span>
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </main>
  );
}
