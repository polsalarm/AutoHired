import { useRef, useState } from "react";
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
}: {
  doc: VaultDocument;
  demoMode: boolean;
  busy: boolean;
  onDelete: (doc: VaultDocument) => void;
  onAnalyze: (doc: VaultDocument) => void;
}) {
  const { icon, chip } = typeIcon[doc.type];
  const ready = doc.status === "analyzed";
  const [menuOpen, setMenuOpen] = useState(false);

  async function download() {
    setMenuOpen(false);
    try {
      const url = await getDocumentUrl(doc.storagePath);
      window.open(url, "_blank", "noopener");
    } catch (err) {
      console.error("Download failed:", err);
    }
  }

  return (
    <div className="bg-surface rounded-xl p-5 shadow-level-1 flex flex-col justify-between border border-outline-variant/30 relative overflow-hidden group">
      <div className="absolute -right-8 -top-8 w-32 h-32 bg-primary-fixed opacity-20 rounded-full blur-2xl group-hover:bg-primary-container transition-colors" />
      <div className="flex items-start justify-between mb-stack-md relative z-10">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${chip}`}>
            <Icon name={icon} />
          </div>
          <div>
            <h4 className="text-body-md font-semibold text-on-surface truncate max-w-[180px]" title={doc.name}>
              {doc.name}
            </h4>
            <span className="text-label-sm text-on-surface-variant">
              {relativeAge(doc.addedAt)}
            </span>
          </div>
        </div>
        <div className="relative">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="text-outline hover:text-on-surface transition-colors"
            aria-label="More options"
          >
            <Icon name="more_vert" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-8 z-20 bg-surface-container-lowest rounded-lg shadow-level-2 border border-outline-variant/30 py-1 w-36">
              <button
                onClick={download}
                disabled={demoMode}
                className="w-full text-left px-3 py-2 text-body-md text-on-surface hover:bg-surface-container-low flex items-center gap-2 disabled:opacity-50"
              >
                <Icon name="download" size={18} />
                Download
              </button>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  onDelete(doc);
                }}
                disabled={demoMode}
                className="w-full text-left px-3 py-2 text-body-md text-error hover:bg-error-container/40 flex items-center gap-2 disabled:opacity-50"
              >
                <Icon name="delete" size={18} />
                Delete
              </button>
            </div>
          )}
        </div>
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
