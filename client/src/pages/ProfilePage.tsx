import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../components/Icon";
import { Avatar } from "../components/Avatar";
import { useAuth } from "../auth/AuthContext";
import { useApplications } from "../hooks/useData";
import {
  computeStats,
  getProfile,
  parseLinks,
  serializeLinks,
  updateProfile,
  type LinkItem,
  type Profile,
} from "../api";
import { mockUser } from "../data/mock";

type Editable = Omit<Profile, "id">;

const EMPTY: Editable = {
  name: "",
  headline: "",
  summary: "",
  skills: "",
  experience: "",
  education: "",
  location: "",
  links: "",
};

// Fields shown in the "Personal Information" panel + edit form.
const INFO_FIELDS: { key: keyof Editable; label: string; icon: string; long?: boolean }[] = [
  { key: "location", label: "Location", icon: "location_on" },
  { key: "skills", label: "Skills", icon: "psychology" },
  { key: "summary", label: "Summary", icon: "description", long: true },
  { key: "experience", label: "Experience", icon: "work", long: true },
  { key: "education", label: "Education", icon: "school", long: true },
  { key: "links", label: "Links", icon: "link", long: true },
];

export function ProfilePage() {
  const { user, demoMode, signOut } = useAuth();
  const { data: applications } = useApplications();

  const [profile, setProfile] = useState<Editable>(EMPTY);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Editable>(EMPTY);
  const [draftLinks, setDraftLinks] = useState<LinkItem[]>([]);

  useEffect(() => {
    if (demoMode || !user) {
      setProfile({ ...EMPTY, name: mockUser.name, headline: mockUser.headline });
      return;
    }
    getProfile(user.id)
      .then((p) => {
        const { id: _id, ...rest } = p;
        setProfile({
          ...rest,
          name: rest.name || user.email?.split("@")[0] || "",
          headline: rest.headline || user.email || "",
        });
      })
      .catch(() => {
        setProfile({
          ...EMPTY,
          name: user.email?.split("@")[0] ?? "",
          headline: user.email ?? "",
        });
      });
  }, [user, demoMode]);

  function startEdit() {
    setDraft(profile);
    setDraftLinks(parseLinks(profile.links));
    setEditing(true);
  }

  async function save() {
    if (!user) return;
    setSaving(true);
    try {
      const trimmed = Object.fromEntries(
        Object.entries(draft).map(([k, v]) => [k, v.trim()]),
      ) as Editable;
      trimmed.links = serializeLinks(draftLinks);
      await updateProfile(user.id, trimmed);
      setProfile(trimmed);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  function setLink(i: number, patch: Partial<LinkItem>) {
    setDraftLinks((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function addLink() {
    setDraftLinks((ls) => [...ls, { label: "", url: "" }]);
  }
  function removeLink(i: number) {
    setDraftLinks((ls) => ls.filter((_, idx) => idx !== i));
  }

  const stats = computeStats(applications ?? []);
  const appCount = applications?.length ?? 0;
  const filledInfo = INFO_FIELDS.filter((f) => profile[f.key]?.trim());

  return (
    <main className="w-full max-w-[1200px] mx-auto pb-stack-xl">
      {/* Gradient hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary-container to-secondary-container opacity-90" />
        <div className="absolute -right-16 -top-16 w-56 h-56 bg-white/15 rounded-full blur-3xl" />
        <div className="absolute -left-12 top-12 w-40 h-40 bg-tertiary-fixed/30 rounded-full blur-3xl" />
        <div className="relative px-container-margin pt-stack-lg pb-stack-lg flex flex-col items-center text-center">
          <Avatar
            label={profile.name || "AutoHired User"}
            size={104}
            rounded="rounded-[2rem]"
            className="ring-4 ring-white/40"
          />
          <h1 className="text-headline-md text-white font-bold mt-stack-md drop-shadow-sm">
            {profile.name || "Your Name"}
          </h1>
          <p className="text-body-md text-white/85 mt-1 max-w-xs truncate">
            {profile.headline || "Add a headline to stand out"}
          </p>
          {!demoMode && (
            <button
              onClick={startEdit}
              className="mt-stack-md bg-white/95 text-primary text-label-md px-5 py-2 rounded-full shadow-level-2 hover:bg-white active:scale-95 transition-all flex items-center gap-2"
            >
              <Icon name="edit" size={16} />
              Edit Profile
            </button>
          )}
        </div>
      </section>

      {/* Stats bento */}
      <section className="px-container-margin -mt-stack-md relative z-10">
        <div className="grid grid-cols-2 gap-unit">
          <StatTile icon="send" tint="text-primary" label="Applications Sent" value={stats.applicationsSent} />
          <StatTile icon="event_available" tint="text-tertiary" label="Interviews" value={stats.interviewsSecured} />
          <div className="col-span-2 bg-surface-container-lowest rounded-2xl p-5 shadow-level-1 border border-outline-variant/20 flex items-center gap-gutter relative overflow-hidden">
            <div className="absolute -right-6 -top-6 w-24 h-24 bg-secondary-fixed/40 rounded-full blur-2xl" />
            <div className="relative w-16 h-16 shrink-0">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-surface-container stroke-current"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  strokeWidth="3.5"
                />
                <path
                  className="text-secondary stroke-current"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  strokeDasharray={`${stats.avgMatchScore}, 100`}
                  strokeLinecap="round"
                  strokeWidth="3.5"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-body-md text-secondary font-bold">
                {stats.avgMatchScore}%
              </span>
            </div>
            <div className="relative z-10">
              <p className="text-label-sm text-on-surface-variant uppercase tracking-wider">
                Avg. Match Score
              </p>
              <p className="text-body-md text-on-surface mt-0.5">
                {stats.avgMatchScore >= 70
                  ? "You're a strong candidate"
                  : stats.avgMatchScore > 0
                    ? "Room to sharpen your resume"
                    : "Analyze a resume to get scored"}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Personal information — used by the AI when scoring applications */}
      <section className="px-container-margin mt-stack-lg">
        <div className="flex items-center justify-between mb-2 ml-1">
          <h2 className="text-label-md text-on-surface-variant uppercase tracking-wider">
            Personal Information
          </h2>
          <span className="text-label-sm text-on-surface-variant flex items-center gap-1">
            <Icon name="auto_awesome" size={14} />
            Used by AI matching
          </span>
        </div>
        <div className="bg-surface-container-lowest rounded-2xl shadow-level-1 border border-outline-variant/20 divide-y divide-outline-variant/15">
          {filledInfo.length === 0 ? (
            <button
              onClick={startEdit}
              disabled={demoMode}
              className="w-full p-5 flex items-center gap-3 text-left disabled:opacity-50"
            >
              <Icon name="badge" className="text-primary" />
              <div>
                <p className="text-body-md text-on-surface font-medium">Add your details</p>
                <p className="text-label-sm text-on-surface-variant">
                  Skills, experience, and education help the AI judge your fit.
                </p>
              </div>
            </button>
          ) : (
            filledInfo.map((f) => (
              <div key={f.key} className="p-4 flex gap-3">
                <div className="w-9 h-9 rounded-full bg-primary-fixed flex items-center justify-center text-primary shrink-0">
                  <Icon name={f.icon} size={18} />
                </div>
                <div className="min-w-0">
                  <p className="text-label-sm text-on-surface-variant uppercase tracking-wider">
                    {f.label}
                  </p>
                  {f.key === "links" ? (
                    <div className="flex flex-col gap-1 mt-1">
                      {parseLinks(profile.links).map((l, i) => (
                        <a
                          key={i}
                          href={l.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-body-md text-primary hover:underline truncate flex items-center gap-1"
                        >
                          <Icon name="open_in_new" size={14} />
                          {l.label || l.url}
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p className={`text-body-md text-on-surface mt-0.5 ${f.long ? "whitespace-pre-line" : "truncate"}`}>
                      {profile[f.key]}
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Shortcuts */}
      <section className="px-container-margin mt-stack-lg flex flex-col gap-unit">
        <h2 className="text-label-md text-on-surface-variant uppercase tracking-wider mb-1 ml-1">
          Shortcuts
        </h2>
        <LinkRow to="/" icon="dashboard" title="Active Applications" meta={`${appCount}`} />
        <LinkRow to="/vault" icon="folder_open" title="Document Vault" meta="Manage" />
        <LinkRow to="/tasks" icon="checklist" title="My Tasks" meta="View" />

        <button
          onClick={() => signOut()}
          disabled={demoMode}
          className="mt-stack-md w-full bg-error-container text-on-error-container text-label-md py-4 rounded-2xl flex items-center justify-center gap-2 shadow-level-1 hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
        >
          <Icon name="logout" />
          {demoMode ? "Sign Out (disabled in demo)" : "Sign Out"}
        </button>
      </section>

      {/* Edit modal */}
      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4"
          onClick={() => !saving && setEditing(false)}
        >
          <div
            className="bg-surface rounded-2xl shadow-level-2 w-full max-w-md max-h-[88vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-container-margin border-b border-outline-variant/20">
              <h3 className="text-body-lg font-semibold text-on-surface">Edit Profile</h3>
            </div>
            <div className="overflow-y-auto p-container-margin flex flex-col gap-stack-md">
              <Field label="Name">
                <input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="Your full name"
                  className={inputCls}
                />
              </Field>
              <Field label="Headline">
                <input
                  value={draft.headline}
                  onChange={(e) => setDraft({ ...draft, headline: e.target.value })}
                  placeholder="e.g. CS student · aspiring PM"
                  className={inputCls}
                />
              </Field>
              <Field label="Location">
                <input
                  value={draft.location}
                  onChange={(e) => setDraft({ ...draft, location: e.target.value })}
                  placeholder="City, Country"
                  className={inputCls}
                />
              </Field>
              <Field label="Skills" hint="Comma-separated">
                <input
                  value={draft.skills}
                  onChange={(e) => setDraft({ ...draft, skills: e.target.value })}
                  placeholder="React, TypeScript, Python, SQL"
                  className={inputCls}
                />
              </Field>
              <Field label="Summary">
                <textarea
                  value={draft.summary}
                  onChange={(e) => setDraft({ ...draft, summary: e.target.value })}
                  placeholder="Short professional summary or objective"
                  rows={3}
                  className={textareaCls}
                />
              </Field>
              <Field label="Experience">
                <textarea
                  value={draft.experience}
                  onChange={(e) => setDraft({ ...draft, experience: e.target.value })}
                  placeholder="Roles, internships, projects…"
                  rows={3}
                  className={textareaCls}
                />
              </Field>
              <Field label="Education">
                <textarea
                  value={draft.education}
                  onChange={(e) => setDraft({ ...draft, education: e.target.value })}
                  placeholder="School, degree, year"
                  rows={2}
                  className={textareaCls}
                />
              </Field>
              <Field label="Links" hint="Name + URL each">
                <div className="flex flex-col gap-2">
                  {draftLinks.map((l, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input
                        value={l.label}
                        onChange={(e) => setLink(i, { label: e.target.value })}
                        placeholder="Portfolio"
                        className="w-28 shrink-0 bg-surface-container-lowest border border-outline-variant/40 rounded-lg h-11 px-3 text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                      <input
                        value={l.url}
                        onChange={(e) => setLink(i, { url: e.target.value })}
                        placeholder="https://…"
                        type="url"
                        className="flex-1 min-w-0 bg-surface-container-lowest border border-outline-variant/40 rounded-lg h-11 px-3 text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                      <button
                        type="button"
                        onClick={() => removeLink(i)}
                        aria-label="Remove link"
                        className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-error-container hover:text-on-error-container transition-colors"
                      >
                        <Icon name="close" size={18} />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addLink}
                    className="self-start flex items-center gap-1 text-label-md text-primary hover:bg-primary-fixed rounded-lg px-2 py-1.5 transition-colors"
                  >
                    <Icon name="add" size={18} />
                    Add link
                  </button>
                </div>
              </Field>
            </div>
            <div className="flex gap-3 p-container-margin border-t border-outline-variant/20">
              <button
                onClick={() => setEditing(false)}
                disabled={saving}
                className="flex-1 py-3 rounded-xl text-label-md text-on-surface-variant hover:bg-surface-container-low transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="flex-1 py-3 rounded-xl text-label-md bg-primary text-on-primary shadow-level-1 hover:bg-on-primary-fixed-variant active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {saving && <Icon name="sync" size={16} className="animate-spin" />}
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

const inputCls =
  "bg-surface-container-lowest border border-outline-variant/40 rounded-lg h-11 px-3 text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary";
const textareaCls =
  "bg-surface-container-lowest border border-outline-variant/40 rounded-lg p-3 text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary resize-none";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-label-md text-on-surface-variant flex items-center gap-2">
        {label}
        {hint && <span className="text-label-sm text-outline">· {hint}</span>}
      </span>
      {children}
    </label>
  );
}

function StatTile({
  icon,
  tint,
  label,
  value,
}: {
  icon: string;
  tint: string;
  label: string;
  value: number;
}) {
  return (
    <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-level-1 border border-outline-variant/20 flex flex-col justify-between h-28 relative overflow-hidden group">
      <div className="absolute -right-4 -top-4 w-16 h-16 bg-surface-container-low rounded-full opacity-60 transition-transform group-hover:scale-150 duration-500" />
      <Icon name={icon} className={`${tint} mb-2 relative z-10`} />
      <div className="relative z-10">
        <p className="text-label-sm text-on-surface-variant uppercase tracking-wider leading-tight">
          {label}
        </p>
        <p className="text-headline-md text-on-surface mt-1 tabular-nums">{value}</p>
      </div>
    </div>
  );
}

function LinkRow({
  to,
  icon,
  title,
  meta,
}: {
  to: string;
  icon: string;
  title: string;
  meta: string;
}) {
  return (
    <Link
      to={to}
      className="bg-surface-container-lowest rounded-2xl p-4 flex items-center justify-between shadow-level-1 border border-outline-variant/20 hover:bg-surface-container-low transition-colors active:scale-[0.98]"
    >
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-primary-fixed flex items-center justify-center text-primary">
          <Icon name={icon} />
        </div>
        <h3 className="text-body-md text-on-surface font-medium">{title}</h3>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-label-md text-on-surface-variant tabular-nums">{meta}</span>
        <Icon name="chevron_right" className="text-outline" />
      </div>
    </Link>
  );
}
