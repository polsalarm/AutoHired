import type { ApplicationStatus } from "../types";

const styles: Record<ApplicationStatus, string> = {
  draft:
    "bg-surface-variant text-on-surface-variant border border-outline-variant/50",
  applying: "bg-tertiary-fixed text-on-tertiary-fixed",
  applied: "bg-primary-container text-on-primary-container",
  interviewing: "bg-tertiary-container text-on-tertiary-container",
  offer: "bg-secondary-container text-on-secondary-container",
  rejected: "bg-error-container text-on-error-container",
};

const labels: Record<ApplicationStatus, string> = {
  draft: "Draft",
  applying: "Applying",
  applied: "Applied",
  interviewing: "Interviewing",
  offer: "Offer",
  rejected: "Rejected",
};

export function StatusChip({ status }: { status: ApplicationStatus }) {
  return (
    <span
      className={`px-2 py-1 rounded-full text-label-sm inline-flex items-center gap-1 ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}
