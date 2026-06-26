import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Icon } from "../components/Icon";
import { Avatar } from "../components/Avatar";
import { ErrorState, Loading } from "../components/states";
import { useAnalysis, useApplication } from "../hooks/useData";
import { useAuth } from "../auth/AuthContext";
import { Checklist } from "../components/Checklist";
import { InterviewPractice } from "../components/InterviewPractice";
import { ResumeBuilder } from "../components/ResumeBuilder";
import {
  deleteApplication,
  updateApplicationDeadline,
  updateApplicationStatus,
} from "../api";
import type { ApplicationStatus } from "../types";

const STATUSES: ApplicationStatus[] = [
  "draft",
  "applying",
  "applied",
  "interviewing",
  "offer",
  "rejected",
];

export function ApplicationDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, demoMode } = useAuth();
  const { data: app, loading, error, reload } = useApplication(id);
  const { data: analysis } = useAnalysis(id);
  const [busy, setBusy] = useState(false);

  async function changeStatus(status: ApplicationStatus) {
    if (demoMode || !app) return;
    setBusy(true);
    try {
      await updateApplicationStatus(app.id, status);
      reload();
    } finally {
      setBusy(false);
    }
  }

  async function changeDeadline(value: string) {
    if (demoMode || !app) return;
    setBusy(true);
    try {
      await updateApplicationDeadline(app.id, value || null);
      reload();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (demoMode || !app) return;
    if (!confirm("Delete this application and its tasks?")) return;
    await deleteApplication(app.id);
    navigate("/");
  }

  if (loading) {
    return (
      <main className="px-container-margin pt-stack-lg">
        <Loading label="Loading application…" />
      </main>
    );
  }
  if (error) {
    return (
      <main className="px-container-margin pt-stack-lg">
        <ErrorState message={error} />
      </main>
    );
  }
  if (!app) {
    return (
      <main className="px-container-margin pt-stack-lg text-center flex flex-col gap-2">
        <p className="text-body-lg text-on-surface-variant">Application not found.</p>
        <Link to="/" className="text-primary text-label-md">
          Back to dashboard
        </Link>
      </main>
    );
  }

  const score = analysis?.matchScore ?? app.matchScore;
  const circumference = 2 * Math.PI * 45;

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
        <div className="flex-1 text-center">
          <h1 className="text-label-md text-on-surface">{app.title}</h1>
          <p className="text-label-sm text-on-surface-variant">@ {app.company}</p>
        </div>
        <button
          onClick={remove}
          disabled={demoMode}
          className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-error-container transition-colors text-on-surface-variant hover:text-on-error-container active:opacity-70 disabled:opacity-30"
          aria-label="Delete application"
        >
          <Icon name="delete" />
        </button>
      </header>

      <main className="w-full max-w-3xl px-container-margin mt-stack-md flex flex-col gap-stack-lg">
        <section className="flex items-center gap-gutter">
          <Avatar label={app.company} size={64} />
          <div>
            <h2 className="text-headline-md text-on-surface">{app.title}</h2>
            <p className="text-body-lg text-on-surface-variant">
              {app.company}
              {app.location ? ` • ${app.location}` : ""}
            </p>
          </div>
        </section>

        {/* Status selector */}
        <section className="flex items-center gap-3">
          <label className="text-label-md text-on-surface-variant">Status</label>
          <div className="relative flex-1">
            <select
              value={app.status}
              disabled={busy || demoMode}
              onChange={(e) => changeStatus(e.target.value as ApplicationStatus)}
              className="w-full bg-surface-container-lowest border border-outline-variant/40 rounded-lg h-11 px-3 pr-9 text-body-md text-on-surface capitalize focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 appearance-none"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s} className="capitalize">
                  {s}
                </option>
              ))}
            </select>
            <Icon
              name="expand_more"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none"
            />
          </div>
        </section>

        {/* Deadline — auto-filled from the scrape, editable any time */}
        <section className="flex items-center gap-3">
          <label className="text-label-md text-on-surface-variant" htmlFor="deadline">
            Deadline
          </label>
          <div className="relative flex-1 flex items-center gap-2">
            <input
              id="deadline"
              type="date"
              value={app.deadline ?? ""}
              disabled={busy || demoMode}
              onChange={(e) => changeDeadline(e.target.value)}
              className="flex-1 bg-surface-container-lowest border border-outline-variant/40 rounded-lg h-11 px-3 text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
            />
            {(() => {
              if (!app.deadline) return null;
              const days = Math.ceil(
                (new Date(app.deadline).getTime() - Date.now()) / 86_400_000,
              );
              const label =
                days < 0 ? "Passed" : days === 0 ? "Today" : `${days}d left`;
              return (
                <span
                  className={`px-3 py-1 rounded-full text-label-sm inline-flex items-center gap-1 shrink-0 ${
                    days <= 3
                      ? "bg-error-container text-on-error-container"
                      : "bg-secondary-container text-on-secondary-container"
                  }`}
                >
                  <Icon name="schedule" size={14} />
                  {label}
                </span>
              );
            })()}
          </div>
        </section>

        {score !== null && (
          <section className="bg-primary-container text-on-primary-container rounded-xl p-container-margin shadow-level-1 relative overflow-hidden flex flex-col sm:flex-row items-center gap-gutter">
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
                  strokeDasharray={circumference}
                  strokeDashoffset={circumference * (1 - score / 100)}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-label-md font-bold">{score}%</span>
              </div>
            </div>
            <div className="flex-1 text-center sm:text-left z-10">
              <h3 className="text-body-lg font-bold mb-1">
                {analysis?.verdict ?? "Match Score"}
              </h3>
              <p className="text-body-md opacity-90">
                {analysis?.summary ??
                  "Run an analysis from the Vault to get AI suggestions."}
              </p>
            </div>
          </section>
        )}

        {analysis && (
          <section className="bg-surface-container-lowest rounded-xl p-container-margin shadow-level-1 border border-surface-container">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-tertiary-container text-on-tertiary-container flex items-center justify-center shrink-0">
                <Icon name="lightbulb" fill size={18} />
              </div>
              <h3 className="text-body-lg font-semibold text-on-surface">
                AI Resume Suggestions
              </h3>
            </div>
            <ul className="space-y-3">
              {analysis.suggestions.map((s) => (
                <li key={s} className="flex items-start gap-3">
                  <Icon name="check_circle" fill className="text-secondary mt-0.5" size={20} />
                  <span className="text-body-md text-on-surface-variant">{s}</span>
                </li>
              ))}
            </ul>

            {(analysis.strengths.length > 0 || analysis.gaps.length > 0) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-stack-md mt-stack-md pt-stack-md border-t border-surface-container">
                {analysis.strengths.length > 0 && (
                  <div>
                    <h4 className="text-label-md text-secondary font-semibold mb-2 flex items-center gap-1">
                      <Icon name="trending_up" size={18} /> Strengths
                    </h4>
                    <ul className="space-y-1.5">
                      {analysis.strengths.map((s) => (
                        <li key={s} className="text-label-md text-on-surface-variant flex items-start gap-2">
                          <Icon name="add" size={16} className="text-secondary mt-0.5 shrink-0" />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {analysis.gaps.length > 0 && (
                  <div>
                    <h4 className="text-label-md text-error font-semibold mb-2 flex items-center gap-1">
                      <Icon name="report" size={18} /> Gaps to address
                    </h4>
                    <ul className="space-y-1.5">
                      {analysis.gaps.map((g) => (
                        <li key={g} className="text-label-md text-on-surface-variant flex items-start gap-2">
                          <Icon name="remove" size={16} className="text-error mt-0.5 shrink-0" />
                          {g}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* Dynamic checklist */}
        <Checklist
          applicationId={app.id}
          appInfo={{
            title: app.title,
            company: app.company,
            requirements: app.requirements,
            deadline: app.deadline,
          }}
          userId={user?.id}
          demoMode={demoMode}
        />

        {/* AI resume + cover letter tailored to this role, downloadable as PDF */}
        <ResumeBuilder
          appInfo={{
            title: app.title,
            company: app.company,
            requirements: app.requirements,
            description: app.description,
          }}
          userId={user?.id}
        />

        {/* AI interview practice — tailored to this role + the user's profile */}
        <InterviewPractice
          appInfo={{
            title: app.title,
            company: app.company,
            requirements: app.requirements,
            description: app.description,
          }}
          userId={user?.id}
        />

        <section className="flex flex-col gap-stack-sm">
          <details
            className="bg-surface-container-lowest rounded-xl shadow-level-1 border border-surface-container group overflow-hidden"
            open
          >
            <summary className="flex justify-between items-center p-container-margin cursor-pointer select-none hover:bg-surface-container-low transition-colors">
              <h3 className="text-label-md text-on-surface">Job Description</h3>
              <Icon name="expand_more" className="text-on-surface-variant transition-transform group-open:rotate-180" />
            </summary>
            <div className="px-container-margin pb-container-margin text-body-md text-on-surface-variant pt-2 border-t border-surface-container-low whitespace-pre-line">
              {app.description || "No description captured."}
            </div>
          </details>
          <details className="bg-surface-container-lowest rounded-xl shadow-level-1 border border-surface-container group overflow-hidden">
            <summary className="flex justify-between items-center p-container-margin cursor-pointer select-none hover:bg-surface-container-low transition-colors">
              <h3 className="text-label-md text-on-surface">Requirements</h3>
              <Icon name="expand_more" className="text-on-surface-variant transition-transform group-open:rotate-180" />
            </summary>
            <div className="px-container-margin pb-container-margin text-body-md text-on-surface-variant pt-2 border-t border-surface-container-low">
              {app.requirements.length === 0 ? (
                <p>No requirements captured.</p>
              ) : (
                <ul className="list-disc pl-5 space-y-2">
                  {app.requirements.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              )}
            </div>
          </details>
        </section>

        <div className="mt-4 mb-8">
          <a
            href={app.url}
            target="_blank"
            rel="noreferrer"
            className="w-full bg-primary hover:bg-on-primary-fixed-variant text-on-primary text-label-md py-3 rounded-lg shadow-level-2 transition-all active:scale-95 flex justify-center items-center gap-2"
          >
            <Icon name="send" size={18} />
            Apply Now
          </a>
        </div>
      </main>
    </div>
  );
}
