import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../components/Icon";
import { Avatar } from "../components/Avatar";
import { EmptyState, ErrorState, Loading } from "../components/states";
import { useApplications, useDocuments } from "../hooks/useData";
import { useAuth } from "../auth/AuthContext";
import {
  analyzeAndSave,
  deleteDocument,
  getDocumentUrl,
  renameDocument,
  uploadAndExtract,
} from "../api";
import type { Application, DocumentType, VaultDocument } from "../types";

const ACCEPT = ".pdf,.docx,.doc,.txt";
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXT = ["pdf", "docx", "doc", "txt"];

const typeIcon: Record<DocumentType, { icon: string; chip: string }> = {
  resume: { icon: "picture_as_pdf", chip: "bg-error-container text-on-error-container" },
  cv: { icon: "picture_as_pdf", chip: "bg-error-container text-on-error-container" },
  cover_letter: { icon: "description", chip: "bg-tertiary-fixed text-tertiary" },
  portfolio: { icon: "link", chip: "bg-secondary-container/20 text-secondary" },
};

function relativeAge(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "Added today";
  if (days < 7) return `Added ${days} day${days > 1 ? "s" : ""} ago`;
  const weeks = Math.floor(days / 7);
  return `Added ${weeks} week${weeks > 1 ? "s" : ""} ago`;
}

const TYPE_LABEL: Record<DocumentType, string> = {
  resume: "Resume",
  cv: "CV",
  cover_letter: "Cover letter",
  portfolio: "Portfolio",
};

function fmtFullDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** File extension from the document name, upper-cased (e.g. "PDF"). */
function fileExt(name: string): string {
  return name.includes(".") ? name.split(".").pop()!.toUpperCase() : "FILE";
}

function detectType(name: string): DocumentType {
  if (/cover/i.test(name)) return "cover_letter";
  if (/portfolio/i.test(name)) return "portfolio";
  if (/\bcv\b/i.test(name)) return "cv";
  return "resume";
}

function DocCard({
  doc,
  demoMode,
  busy,
  onDelete,
  onAnalyze,
  onRename,
}: {
  doc: VaultDocument;
  demoMode: boolean;
  busy: boolean;
  onDelete: (doc: VaultDocument) => void;
  onAnalyze: (doc: VaultDocument) => void;
  onRename: (doc: VaultDocument, name: string) => Promise<void>;
}) {
  const { icon, chip } = typeIcon[doc.type];
  const ready = doc.status === "analyzed";
  const [details, setDetails] = useState<false | "view" | "rename">(false);

  async function openFile() {
    try {
      const url = await getDocumentUrl(doc.storagePath);
      window.open(url, "_blank", "noopener");
    } catch (err) {
      console.error("Open failed:", err);
    }
  }

  async function download() {
    try {
      const url = await getDocumentUrl(doc.storagePath);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.name;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      console.error("Download failed:", err);
    }
  }

  return (
    <div className="bg-surface rounded-xl p-5 shadow-level-1 flex flex-col justify-between border border-outline-variant/30 relative group">
      {/* Decorative blob — clipped to its own rounded layer so it never bleeds
          out, while the card itself does NOT clip (the menu can overflow). */}
      <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
        <div className="absolute -right-8 -top-8 w-32 h-32 bg-primary-fixed opacity-20 rounded-full blur-2xl group-hover:bg-primary-container transition-colors" />
      </div>

      <div className="flex items-start justify-between mb-stack-md relative z-20">
        <button
          onClick={() => setDetails("view")}
          className="flex items-center gap-3 min-w-0 text-left"
          title="View details"
        >
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${chip}`}>
            <Icon name={icon} />
          </div>
          <div className="min-w-0">
            <h4 className="text-body-md font-semibold text-on-surface truncate max-w-[180px]" title={doc.name}>
              {doc.name}
            </h4>
            <span className="text-label-sm text-on-surface-variant">
              {relativeAge(doc.addedAt)}
            </span>
          </div>
        </button>

        <button
          onClick={() => setDetails("view")}
          className="w-9 h-9 -mr-2 -mt-1 shrink-0 rounded-full flex items-center justify-center text-outline hover:text-on-surface hover:bg-surface-container-low transition-colors"
          aria-label="File options & details"
        >
          <Icon name="more_vert" />
        </button>
      </div>

      <div className="flex items-center justify-between mt-auto relative z-10 pt-stack-sm border-t border-outline-variant/20">
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${ready ? "bg-secondary-container" : "bg-outline-variant"}`}
          />
          <span className="text-label-sm text-on-surface-variant">
            {ready ? "Text ready" : "No text"}
          </span>
        </div>
        <button
          onClick={() => onAnalyze(doc)}
          disabled={!ready || demoMode || busy}
          title={ready ? "Match this document to an application" : "No extracted text to analyze"}
          className={`px-4 py-2 rounded-xl text-label-sm transition-colors active:scale-95 flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed ${
            ready
              ? "bg-primary text-on-primary hover:bg-on-primary-fixed-variant shadow-level-1"
              : "bg-surface-container-high text-primary"
          }`}
        >
          <Icon name={busy ? "sync" : "analytics"} size={16} className={busy ? "animate-spin" : ""} />
          Analyze
        </button>
      </div>

      {details && (
        <DocDetailsModal
          doc={doc}
          startEditing={details === "rename"}
          demoMode={demoMode}
          onClose={() => setDetails(false)}
          onOpen={openFile}
          onDownload={download}
          onRename={onRename}
          onDelete={onDelete}
        />
      )}
    </div>
  );
}

export function VaultPage() {
  const { user, demoMode } = useAuth();
  const navigate = useNavigate();
  const { data, loading, error, reload } = useDocuments();
  const { data: apps } = useApplications();
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [pickFor, setPickFor] = useState<VaultDocument | null>(null);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);

  function validate(file: File): string | null {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!ALLOWED_EXT.includes(ext)) return `${file.name}: unsupported type`;
    if (file.size > MAX_BYTES) return `${file.name}: exceeds 10 MB`;
    return null;
  }

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    if (demoMode || !user) {
      setUploadError("Demo mode: configure Supabase to upload documents.");
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      for (const file of Array.from(files)) {
        const invalid = validate(file);
        if (invalid) {
          setUploadError(invalid);
          continue;
        }
        await uploadAndExtract(user.id, file, detectType(file.name));
      }
      reload();
    } catch (err) {
      setUploadError((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(doc: VaultDocument) {
    if (!confirm(`Delete ${doc.name}?`)) return;
    try {
      await deleteDocument(doc.id, doc.storagePath);
      reload();
    } catch (err) {
      setUploadError((err as Error).message);
    }
  }

  async function handleRename(doc: VaultDocument, name: string) {
    if (demoMode || !user) {
      setUploadError("Demo mode: configure Supabase to rename documents.");
      return;
    }
    await renameDocument(doc.id, name);
    reload();
  }

  async function runAnalysis(doc: VaultDocument, app: Application) {
    setPickFor(null);
    if (demoMode || !user) {
      setUploadError("Demo mode: configure Supabase to run analysis.");
      return;
    }
    setAnalyzingId(doc.id);
    setUploadError(null);
    try {
      await analyzeAndSave(
        user.id,
        {
          id: app.id,
          title: app.title,
          company: app.company,
          requirements: app.requirements,
          description: app.description,
        },
        { id: doc.id, parsedText: doc.parsedText },
      );
      navigate(`/applications/${app.id}`);
    } catch (err) {
      setUploadError((err as Error).message);
    } finally {
      setAnalyzingId(null);
    }
  }

  const docs = data ?? [];

  return (
    <main className="max-w-[1200px] mx-auto px-container-margin py-stack-md w-full">
      <div className="mb-stack-md">
        <h1 className="text-headline-lg-mobile text-on-surface">Document Vault</h1>
        <p className="text-body-md text-on-surface-variant mt-stack-sm">
          Manage and analyze your application materials.
        </p>
      </div>

      <section className="mb-stack-lg">
        <div
          className="border-2 border-dashed border-outline-variant bg-surface-container-low rounded-xl p-stack-lg flex flex-col items-center justify-center text-center cursor-pointer hover:bg-surface-container transition-colors shadow-level-1"
          onClick={() => fileInput.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handleFiles(e.dataTransfer.files);
          }}
        >
          <div className="w-16 h-16 bg-primary-fixed text-on-primary-fixed rounded-full flex items-center justify-center mb-stack-md shadow-level-1">
            <Icon name={uploading ? "sync" : "cloud_upload"} size={32} className={uploading ? "animate-spin" : ""} />
          </div>
          <h3 className="text-body-lg font-semibold text-on-surface mb-stack-sm">
            {uploading ? "Uploading & extracting…" : "Upload Resume/Portfolio"}
          </h3>
          <p className="text-body-md text-on-surface-variant mb-stack-md">
            Drag and drop your PDF, DOCX, or TXT here (max 10 MB).
          </p>
          <button className="bg-primary text-on-primary px-6 py-3 rounded-xl text-label-md shadow-level-2 hover:bg-on-primary-fixed-variant transition-colors active:scale-95">
            Browse Files
          </button>
          <input
            ref={fileInput}
            type="file"
            accept={ACCEPT}
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>
        {uploadError && (
          <p className="text-label-md text-error mt-2 px-1">{uploadError}</p>
        )}
      </section>

      {loading && <Loading label="Loading documents…" />}
      {error && <ErrorState message={error} />}
      {!loading && !error && docs.length === 0 && (
        <EmptyState
          icon="folder_open"
          title="Vault is empty"
          hint="Upload a resume or portfolio to analyze it against your applications."
        />
      )}

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-stack-md">
        {docs.map((doc) => (
          <DocCard
            key={doc.id}
            doc={doc}
            demoMode={demoMode}
            busy={analyzingId === doc.id}
            onDelete={handleDelete}
            onAnalyze={setPickFor}
            onRename={handleRename}
          />
        ))}
      </section>

      {pickFor && (
        <ApplicationPicker
          doc={pickFor}
          apps={apps ?? []}
          onClose={() => setPickFor(null)}
          onPick={(app) => runAnalysis(pickFor, app)}
        />
      )}
    </main>
  );
}

function ApplicationPicker({
  doc,
  apps,
  onClose,
  onPick,
}: {
  doc: VaultDocument;
  apps: Application[];
  onClose: () => void;
  onPick: (app: Application) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="bg-surface rounded-xl shadow-level-2 w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-container-margin border-b border-outline-variant/30">
          <h3 className="text-body-lg font-semibold text-on-surface">
            Analyze against…
          </h3>
          <p className="text-label-sm text-on-surface-variant truncate">
            {doc.name}
          </p>
        </div>
        <div className="overflow-y-auto p-2">
          {apps.length === 0 ? (
            <p className="text-body-md text-on-surface-variant text-center p-stack-md">
              No applications yet. Add one first, then analyze.
            </p>
          ) : (
            apps.map((app) => (
              <button
                key={app.id}
                onClick={() => onPick(app)}
                className="w-full text-left px-3 py-3 rounded-lg hover:bg-surface-container-low transition-colors flex items-center gap-3"
              >
                <Avatar label={app.company} size={36} rounded="rounded-lg" />
                <div className="min-w-0">
                  <p className="text-body-md text-on-surface truncate">{app.title}</p>
                  <p className="text-label-sm text-on-surface-variant truncate">
                    {app.company}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
        <button
          onClick={onClose}
          className="m-2 py-2 rounded-lg text-label-md text-on-surface-variant hover:bg-surface-container-low transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function DocDetailsModal({
  doc,
  startEditing,
  demoMode,
  onClose,
  onOpen,
  onDownload,
  onRename,
  onDelete,
}: {
  doc: VaultDocument;
  startEditing: boolean;
  demoMode: boolean;
  onClose: () => void;
  onOpen: () => void;
  onDownload: () => void;
  onRename: (doc: VaultDocument, name: string) => Promise<void>;
  onDelete: (doc: VaultDocument) => void;
}) {
  const { icon, chip } = typeIcon[doc.type];
  const ready = doc.status === "analyzed";
  const chars = doc.parsedText?.length ?? 0;
  const [editing, setEditing] = useState(startEditing);
  const [name, setName] = useState(doc.name);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  async function save() {
    const next = name.trim();
    if (!next || next === doc.name) {
      setEditing(false);
      setName(doc.name);
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      await onRename(doc, next);
      setEditing(false);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 p-4 overscroll-none"
      onClick={() => !saving && onClose()}
    >
      <div
        className="bg-surface rounded-2xl shadow-level-2 w-full max-w-md max-h-[88dvh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-container-margin flex items-start gap-3 border-b border-outline-variant/20">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${chip}`}>
            <Icon name={icon} size={26} />
          </div>
          <div className="min-w-0 flex-1">
            {editing ? (
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") save();
                  if (e.key === "Escape") {
                    setEditing(false);
                    setName(doc.name);
                  }
                }}
                className="w-full bg-surface-container-lowest border border-outline-variant/40 rounded-lg h-10 px-3 text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
              />
            ) : (
              <h3 className="text-body-lg font-semibold text-on-surface break-words" title={doc.name}>
                {doc.name}
              </h3>
            )}
            <p className="text-label-sm text-on-surface-variant mt-0.5">
              {fileExt(doc.name)} · {TYPE_LABEL[doc.type]}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container shrink-0"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-container-margin flex flex-col gap-stack-md">
          {editing ? (
            <div className="flex items-center gap-2">
              <button
                onClick={save}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl text-label-md bg-primary text-on-primary shadow-level-1 hover:bg-on-primary-fixed-variant active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {saving && <Icon name="sync" size={16} className="animate-spin" />}
                Save name
              </button>
              <button
                onClick={() => {
                  setEditing(false);
                  setName(doc.name);
                }}
                disabled={saving}
                className="py-2.5 px-4 rounded-xl text-label-md text-on-surface-variant hover:bg-surface-container-low transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setEditing(true)}
              disabled={demoMode}
              className="self-start text-label-md text-primary hover:bg-primary-fixed rounded-lg px-2 py-1 -ml-2 transition-colors flex items-center gap-1.5 disabled:opacity-40"
            >
              <Icon name="edit" size={16} />
              Rename
            </button>
          )}
          {err && <p className="text-label-md text-error -mt-1">{err}</p>}

          <dl className="divide-y divide-outline-variant/15 rounded-xl bg-surface-container-low overflow-hidden">
            <DetailRow label="Type" value={TYPE_LABEL[doc.type]} />
            <DetailRow label="Status" value={ready ? "Text extracted" : "No text yet"} />
            <DetailRow label="Added" value={fmtFullDate(doc.addedAt)} />
          </dl>

          {ready && doc.parsedText && (
            <div>
              <p className="text-label-sm text-on-surface-variant uppercase tracking-wide mb-1.5">
                Text preview
                <span className="text-outline normal-case tracking-normal">
                  {" · "}
                  {chars.toLocaleString()} characters
                </span>
              </p>
              <p className="text-body-md text-on-surface-variant bg-surface-container-low rounded-xl p-3 max-h-40 overflow-y-auto whitespace-pre-line">
                {doc.parsedText.slice(0, 600)}
                {doc.parsedText.length > 600 ? "…" : ""}
              </p>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center gap-2 p-container-margin border-t border-outline-variant/20">
          <button
            onClick={onOpen}
            disabled={demoMode}
            className="flex-1 py-2.5 rounded-xl text-label-md bg-surface-container-high text-on-surface hover:bg-surface-container transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40"
          >
            <Icon name="open_in_new" size={18} />
            Open
          </button>
          <button
            onClick={onDownload}
            disabled={demoMode}
            className="flex-1 py-2.5 rounded-xl text-label-md bg-surface-container-high text-on-surface hover:bg-surface-container transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40"
          >
            <Icon name="download" size={18} />
            Download
          </button>
          <button
            onClick={() => {
              onClose();
              onDelete(doc);
            }}
            disabled={demoMode}
            aria-label="Delete document"
            className="w-11 h-11 shrink-0 rounded-xl flex items-center justify-center text-error hover:bg-error-container/40 transition-colors disabled:opacity-40"
          >
            <Icon name="delete" size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-3.5 py-2.5">
      <dt className="text-label-md text-on-surface-variant shrink-0">{label}</dt>
      <dd className="text-body-md text-on-surface text-right break-words">{value}</dd>
    </div>
  );
}
