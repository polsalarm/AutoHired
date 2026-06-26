import { useEffect, useState } from "react";
import { pdf } from "@react-pdf/renderer";
import { Icon } from "./Icon";
import { CoverLetterDocument, ResumeDocument } from "./pdf/ResumePdf";
import { listDocuments, tailorResume, uploadDocument } from "../api";
import type {
  CoverLetter,
  ResumeTailorResult,
  TailoredResume,
  VaultDocument,
} from "../types";

/** Documents we can tailor from — must carry extracted text. */
function usableResumes(docs: VaultDocument[]): VaultDocument[] {
  return docs.filter(
    (d) =>
      (d.type === "resume" || d.type === "cv") &&
      Boolean(d.parsedText && d.parsedText.trim().length >= 20),
  );
}

function safeName(s: string): string {
  return (s || "document").replace(/[^\w.-]+/g, "_").slice(0, 60);
}

async function pdfFile(node: React.ReactElement, filename: string): Promise<File> {
  const blob = await pdf(node).toBlob();
  return new File([blob], filename, { type: "application/pdf" });
}

function triggerDownload(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Flattens a tailored resume to plain text so the saved PDF stays analyzable. */
function resumeToText(r: TailoredResume): string {
  const out: string[] = [r.name, r.headline].filter(Boolean);
  const contact = [r.contact.email, r.contact.phone, r.contact.location, ...r.contact.links]
    .filter(Boolean)
    .join(" | ");
  if (contact) out.push(contact);
  if (r.summary) out.push("", "SUMMARY", r.summary);
  if (r.skills.length) out.push("", "SKILLS", r.skills.join(", "));
  if (r.experience.length) {
    out.push("", "EXPERIENCE");
    for (const job of r.experience) {
      const head = [job.role, job.company, job.location, job.period].filter(Boolean).join(" — ");
      if (head) out.push(head);
      for (const b of job.bullets) out.push(`- ${b}`);
    }
  }
  if (r.education.length) {
    out.push("", "EDUCATION");
    for (const ed of r.education) {
      out.push([ed.degree, ed.institution, ed.period].filter(Boolean).join(" — "));
      if (ed.detail) out.push(ed.detail);
    }
  }
  return out.join("\n");
}

function coverLetterToText(c: CoverLetter): string {
  return [c.greeting, ...c.body, c.closing, c.signature].filter(Boolean).join("\n\n");
}

export function ResumeBuilder({
  appInfo,
  userId,
  demoMode,
}: {
  appInfo: {
    title: string;
    company: string;
    requirements: string[];
    description: string;
  };
  userId: string | undefined;
  demoMode?: boolean;
}) {
  const [docs, setDocs] = useState<VaultDocument[] | null>(null);
  const [selectedId, setSelectedId] = useState<string>("");
  const [result, setResult] = useState<ResumeTailorResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState<"resume" | "cover" | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    listDocuments()
      .then((all) => {
        if (!alive) return;
        const usable = usableResumes(all);
        setDocs(usable);
        if (usable.length > 0) setSelectedId(usable[0].id);
      })
      .catch((e) => alive && setError((e as Error).message));
    return () => {
      alive = false;
    };
  }, []);

  async function generate() {
    const doc = docs?.find((d) => d.id === selectedId);
    if (!doc?.parsedText) return;
    setLoading(true);
    setError(null);
    setSavedMsg(null);
    try {
      const res = await tailorResume(userId, appInfo, doc.parsedText);
      setResult(res);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  // Filenames shared by download + Vault save so a doc is recognizable in both.
  function resumeName() {
    return `${safeName(result!.resume.name)}_${safeName(appInfo.company)}_Resume.pdf`;
  }
  function coverName() {
    return `${safeName(result!.coverLetter.signature)}_${safeName(appInfo.company)}_CoverLetter.pdf`;
  }
  function resumeNode() {
    return <ResumeDocument resume={result!.resume} />;
  }
  function coverNode() {
    return (
      <CoverLetterDocument
        letter={result!.coverLetter}
        company={appInfo.company}
        role={appInfo.title}
      />
    );
  }

  async function downloadResume() {
    if (!result) return;
    setDownloading("resume");
    try {
      triggerDownload(await pdfFile(resumeNode(), resumeName()));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDownloading(null);
    }
  }

  async function downloadCoverLetter() {
    if (!result) return;
    setDownloading("cover");
    try {
      triggerDownload(await pdfFile(coverNode(), coverName()));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDownloading(null);
    }
  }

  /** Renders both PDFs and stores them in the user's Supabase Vault. */
  async function saveToVault() {
    if (!result || !userId || demoMode) return;
    setSaving(true);
    setSavedMsg(null);
    setError(null);
    try {
      const resumeFile = await pdfFile(resumeNode(), resumeName());
      await uploadDocument(userId, resumeFile, "resume", resumeToText(result.resume));
      const coverFile = await pdfFile(coverNode(), coverName());
      await uploadDocument(
        userId,
        coverFile,
        "cover_letter",
        coverLetterToText(result.coverLetter),
      );
      setSavedMsg("Saved résumé + cover letter to your Vault.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="bg-surface-container-lowest rounded-xl p-container-margin shadow-level-1 border border-surface-container">
      <div className="flex items-center gap-3 mb-1">
        <div className="w-8 h-8 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center shrink-0">
          <Icon name="auto_awesome" fill size={18} />
        </div>
        <div className="flex-1">
          <h3 className="text-body-lg font-semibold text-on-surface">
            Tailored Resume & Cover Letter
          </h3>
          <p className="text-label-sm text-on-surface-variant">
            AI rewrites your resume for this role — download as PDF
          </p>
        </div>
        {result && !loading && (
          <button
            onClick={generate}
            className="text-label-md text-primary hover:bg-primary-fixed rounded-lg px-3 py-1.5 transition-colors flex items-center gap-1 shrink-0"
          >
            <Icon name="refresh" size={16} />
            Regenerate
          </button>
        )}
      </div>

      {error && (
        <p className="text-body-md text-error py-3 flex items-center gap-2">
          <Icon name="error" size={18} />
          {error}
        </p>
      )}

      {/* No resume on file */}
      {docs && docs.length === 0 && (
        <p className="text-body-md text-on-surface-variant py-4 flex items-start gap-2">
          <Icon name="info" size={18} className="mt-0.5 shrink-0" />
          Upload a resume in the Vault first (it must have extractable text), then
          come back to generate a tailored version.
        </p>
      )}

      {/* Picker + generate */}
      {docs && docs.length > 0 && !result && (
        <div className="mt-stack-md flex flex-col gap-3">
          {docs.length > 1 && (
            <div className="relative">
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                disabled={loading}
                className="w-full bg-surface-container-lowest border border-outline-variant/40 rounded-lg h-11 px-3 pr-9 text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 appearance-none"
              >
                {docs.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              <Icon
                name="expand_more"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none"
              />
            </div>
          )}
          <button
            onClick={generate}
            disabled={loading || !selectedId}
            className="bg-primary text-on-primary rounded-xl p-4 text-left shadow-level-1 hover:bg-on-primary-fixed-variant active:scale-95 transition-all flex items-center gap-3 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Icon name="sync" className="animate-spin" size={20} />
                <span className="text-label-md font-semibold">
                  Tailoring to {appInfo.company || "this role"}…
                </span>
              </>
            ) : (
              <>
                <Icon name="auto_awesome" fill size={20} />
                <span className="text-label-md font-semibold">
                  Generate tailored resume + cover letter
                </span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Result: changelog + downloads */}
      {result && !loading && (
        <div className="mt-stack-md flex flex-col gap-stack-md">
          {result.changelog.length > 0 && (
            <div>
              <h4 className="text-label-md text-secondary font-semibold mb-2 flex items-center gap-1">
                <Icon name="edit_note" size={18} /> What changed for this role
              </h4>
              <ul className="space-y-1.5">
                {result.changelog.map((c, i) => (
                  <li
                    key={i}
                    className="text-label-md text-on-surface-variant flex items-start gap-2"
                  >
                    <Icon name="check_circle" fill size={16} className="text-secondary mt-0.5 shrink-0" />
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={downloadResume}
              disabled={downloading !== null || saving}
              className="bg-surface border border-outline-variant/40 text-on-surface rounded-xl p-4 hover:bg-surface-container-low active:scale-95 transition-all flex items-center gap-3 disabled:opacity-50"
            >
              <Icon
                name={downloading === "resume" ? "sync" : "picture_as_pdf"}
                className={downloading === "resume" ? "animate-spin text-primary" : "text-primary"}
                size={22}
              />
              <span className="text-label-md font-semibold">Download résumé PDF</span>
            </button>
            <button
              onClick={downloadCoverLetter}
              disabled={downloading !== null || saving}
              className="bg-surface border border-outline-variant/40 text-on-surface rounded-xl p-4 hover:bg-surface-container-low active:scale-95 transition-all flex items-center gap-3 disabled:opacity-50"
            >
              <Icon
                name={downloading === "cover" ? "sync" : "description"}
                className={downloading === "cover" ? "animate-spin text-primary" : "text-primary"}
                size={22}
              />
              <span className="text-label-md font-semibold">Download cover letter PDF</span>
            </button>
          </div>

          {/* Save both PDFs to the Supabase Vault (disabled in demo / signed-out) */}
          {savedMsg ? (
            <p className="text-body-md text-secondary flex items-center gap-2">
              <Icon name="cloud_done" fill size={20} />
              {savedMsg}
            </p>
          ) : (
            <button
              onClick={saveToVault}
              disabled={saving || downloading !== null || !userId || demoMode}
              className="bg-secondary-container text-on-secondary-container rounded-xl p-4 hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-40"
            >
              <Icon
                name={saving ? "sync" : "cloud_upload"}
                fill
                className={saving ? "animate-spin" : ""}
                size={22}
              />
              <span className="text-label-md font-semibold">
                {saving ? "Saving to Vault…" : "Save both to Vault"}
              </span>
            </button>
          )}
          {demoMode && (
            <p className="text-label-sm text-on-surface-variant">
              Saving to the Vault is disabled in demo mode.
            </p>
          )}
          <p className="text-label-sm text-on-surface-variant flex items-start gap-1.5">
            <Icon name="info" size={14} className="mt-0.5 shrink-0" />
            AI-generated from your uploaded resume — review and edit before sending.
          </p>
        </div>
      )}
    </section>
  );
}
