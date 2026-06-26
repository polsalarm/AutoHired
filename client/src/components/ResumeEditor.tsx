import { Icon } from "./Icon";
import type {
  CoverLetter,
  ResumeEducation,
  ResumeExperience,
  ResumeTailorResult,
  TailoredResume,
} from "../types";

/**
 * Full structural editor for a tailored resume + cover letter. Operates on the
 * structured JSON the LLM returned — every edit flows straight into the PDF on
 * download/save, with no re-generation. Reorder via up/down; add/remove per list.
 */

const inputCls =
  "w-full bg-surface-container-lowest border border-outline-variant/40 rounded-lg px-3 py-2 text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary";
const labelCls = "text-label-sm text-on-surface-variant font-medium";

// --- immutable array helpers ---
function setAt<T>(arr: T[], i: number, v: T): T[] {
  const next = arr.slice();
  next[i] = v;
  return next;
}
function removeAt<T>(arr: T[], i: number): T[] {
  return arr.filter((_, j) => j !== i);
}
function move<T>(arr: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir;
  if (j < 0 || j >= arr.length) return arr;
  const next = arr.slice();
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

function IconBtn({
  icon,
  onClick,
  disabled,
  label,
}: {
  icon: string;
  onClick: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="w-7 h-7 rounded-md flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-colors disabled:opacity-30 shrink-0"
    >
      <Icon name={icon} size={16} />
    </button>
  );
}

/** Editable list of plain strings (skills, links, bullets, cover paragraphs). */
function StringList({
  items,
  onChange,
  placeholder,
  multiline,
  addLabel,
}: {
  items: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  multiline?: boolean;
  addLabel: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      {items.map((v, i) => (
        <div key={i} className="flex gap-2 items-start">
          {multiline ? (
            <textarea
              className={inputCls}
              rows={2}
              value={v}
              placeholder={placeholder}
              onChange={(e) => onChange(setAt(items, i, e.target.value))}
            />
          ) : (
            <input
              className={inputCls}
              value={v}
              placeholder={placeholder}
              onChange={(e) => onChange(setAt(items, i, e.target.value))}
            />
          )}
          <div className="flex gap-0.5 pt-1">
            <IconBtn icon="arrow_upward" label="Move up" onClick={() => onChange(move(items, i, -1))} disabled={i === 0} />
            <IconBtn icon="arrow_downward" label="Move down" onClick={() => onChange(move(items, i, 1))} disabled={i === items.length - 1} />
            <IconBtn icon="close" label="Remove" onClick={() => onChange(removeAt(items, i))} />
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, ""])}
        className="self-start text-label-md text-primary hover:bg-primary-fixed rounded-lg px-2 py-1 transition-colors flex items-center gap-1"
      >
        <Icon name="add" size={16} /> {addLabel}
      </button>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 pt-stack-md border-t border-surface-container first:border-t-0 first:pt-0">
      <h4 className="text-label-md text-secondary font-semibold uppercase tracking-wide">{title}</h4>
      {children}
    </div>
  );
}

const EMPTY_EXP: ResumeExperience = { role: "", company: "", location: "", period: "", bullets: [] };
const EMPTY_EDU: ResumeEducation = { degree: "", institution: "", period: "", detail: "" };

export function ResumeEditor({
  value,
  onChange,
}: {
  value: ResumeTailorResult;
  onChange: (next: ResumeTailorResult) => void;
}) {
  const { resume, coverLetter } = value;

  function setResume(patch: Partial<TailoredResume>) {
    onChange({ ...value, resume: { ...resume, ...patch } });
  }
  function setContact(patch: Partial<TailoredResume["contact"]>) {
    setResume({ contact: { ...resume.contact, ...patch } });
  }
  function setExperience(next: ResumeExperience[]) {
    setResume({ experience: next });
  }
  function setEducation(next: ResumeEducation[]) {
    setResume({ education: next });
  }
  function setCover(patch: Partial<CoverLetter>) {
    onChange({ ...value, coverLetter: { ...coverLetter, ...patch } });
  }

  return (
    <div className="flex flex-col gap-stack-md bg-surface rounded-xl border border-outline-variant/30 p-container-margin">
      {/* Header / contact */}
      <Section title="Header">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className={labelCls}>Name</span>
            <input className={inputCls} value={resume.name} onChange={(e) => setResume({ name: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1">
            <span className={labelCls}>Headline</span>
            <input className={inputCls} value={resume.headline} onChange={(e) => setResume({ headline: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1">
            <span className={labelCls}>Email</span>
            <input className={inputCls} value={resume.contact.email} onChange={(e) => setContact({ email: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1">
            <span className={labelCls}>Phone</span>
            <input className={inputCls} value={resume.contact.phone} onChange={(e) => setContact({ phone: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1">
            <span className={labelCls}>Location</span>
            <input className={inputCls} value={resume.contact.location} onChange={(e) => setContact({ location: e.target.value })} />
          </label>
        </div>
        <span className={labelCls}>Links</span>
        <StringList
          items={resume.contact.links}
          onChange={(links) => setContact({ links })}
          placeholder="https://…"
          addLabel="Add link"
        />
      </Section>

      {/* Summary */}
      <Section title="Summary">
        <textarea
          className={inputCls}
          rows={4}
          value={resume.summary}
          onChange={(e) => setResume({ summary: e.target.value })}
        />
      </Section>

      {/* Skills */}
      <Section title="Skills">
        <StringList
          items={resume.skills}
          onChange={(skills) => setResume({ skills })}
          placeholder="e.g. React"
          addLabel="Add skill"
        />
      </Section>

      {/* Experience */}
      <Section title="Experience">
        {resume.experience.map((job, i) => (
          <div key={i} className="rounded-lg border border-outline-variant/30 p-3 flex flex-col gap-2">
            <div className="flex justify-end gap-0.5">
              <IconBtn icon="arrow_upward" label="Move up" onClick={() => setExperience(move(resume.experience, i, -1))} disabled={i === 0} />
              <IconBtn icon="arrow_downward" label="Move down" onClick={() => setExperience(move(resume.experience, i, 1))} disabled={i === resume.experience.length - 1} />
              <IconBtn icon="delete" label="Remove job" onClick={() => setExperience(removeAt(resume.experience, i))} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input className={inputCls} placeholder="Role" value={job.role} onChange={(e) => setExperience(setAt(resume.experience, i, { ...job, role: e.target.value }))} />
              <input className={inputCls} placeholder="Company" value={job.company} onChange={(e) => setExperience(setAt(resume.experience, i, { ...job, company: e.target.value }))} />
              <input className={inputCls} placeholder="Location" value={job.location} onChange={(e) => setExperience(setAt(resume.experience, i, { ...job, location: e.target.value }))} />
              <input className={inputCls} placeholder="Period (e.g. 2021 – Present)" value={job.period} onChange={(e) => setExperience(setAt(resume.experience, i, { ...job, period: e.target.value }))} />
            </div>
            <span className={labelCls}>Bullets</span>
            <StringList
              items={job.bullets}
              onChange={(bullets) => setExperience(setAt(resume.experience, i, { ...job, bullets }))}
              placeholder="Achievement, impact-focused"
              multiline
              addLabel="Add bullet"
            />
          </div>
        ))}
        <button
          type="button"
          onClick={() => setExperience([...resume.experience, { ...EMPTY_EXP, bullets: [] }])}
          className="self-start text-label-md text-primary hover:bg-primary-fixed rounded-lg px-2 py-1 transition-colors flex items-center gap-1"
        >
          <Icon name="add" size={16} /> Add job
        </button>
      </Section>

      {/* Education */}
      <Section title="Education">
        {resume.education.map((ed, i) => (
          <div key={i} className="rounded-lg border border-outline-variant/30 p-3 flex flex-col gap-2">
            <div className="flex justify-end gap-0.5">
              <IconBtn icon="arrow_upward" label="Move up" onClick={() => setEducation(move(resume.education, i, -1))} disabled={i === 0} />
              <IconBtn icon="arrow_downward" label="Move down" onClick={() => setEducation(move(resume.education, i, 1))} disabled={i === resume.education.length - 1} />
              <IconBtn icon="delete" label="Remove education" onClick={() => setEducation(removeAt(resume.education, i))} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input className={inputCls} placeholder="Degree" value={ed.degree} onChange={(e) => setEducation(setAt(resume.education, i, { ...ed, degree: e.target.value }))} />
              <input className={inputCls} placeholder="Institution" value={ed.institution} onChange={(e) => setEducation(setAt(resume.education, i, { ...ed, institution: e.target.value }))} />
              <input className={inputCls} placeholder="Period" value={ed.period} onChange={(e) => setEducation(setAt(resume.education, i, { ...ed, period: e.target.value }))} />
              <input className={inputCls} placeholder="Detail (honors, GPA…)" value={ed.detail} onChange={(e) => setEducation(setAt(resume.education, i, { ...ed, detail: e.target.value }))} />
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setEducation([...resume.education, { ...EMPTY_EDU }])}
          className="self-start text-label-md text-primary hover:bg-primary-fixed rounded-lg px-2 py-1 transition-colors flex items-center gap-1"
        >
          <Icon name="add" size={16} /> Add education
        </button>
      </Section>

      {/* Cover letter */}
      <Section title="Cover letter">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className={labelCls}>Greeting</span>
            <input className={inputCls} value={coverLetter.greeting} onChange={(e) => setCover({ greeting: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1">
            <span className={labelCls}>Closing</span>
            <input className={inputCls} value={coverLetter.closing} onChange={(e) => setCover({ closing: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1">
            <span className={labelCls}>Signature</span>
            <input className={inputCls} value={coverLetter.signature} onChange={(e) => setCover({ signature: e.target.value })} />
          </label>
        </div>
        <span className={labelCls}>Paragraphs</span>
        <StringList
          items={coverLetter.body}
          onChange={(body) => setCover({ body })}
          placeholder="Paragraph text"
          multiline
          addLabel="Add paragraph"
        />
      </Section>
    </div>
  );
}
