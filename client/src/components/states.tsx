import { Icon } from "./Icon";

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-stack-xl gap-stack-sm text-on-surface-variant">
      <Icon name="sync" size={32} className="animate-spin" />
      <p className="text-body-md">{label}</p>
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-stack-xl gap-stack-sm text-center">
      <Icon name="error" size={40} className="text-error" />
      <p className="text-body-md text-on-surface-variant max-w-xs">{message}</p>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  hint,
}: {
  icon: string;
  title: string;
  hint: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-stack-xl text-center gap-stack-sm">
      <Icon name={icon} size={48} className="text-outline" />
      <p className="text-headline-md text-on-surface-variant">{title}</p>
      <p className="text-body-md text-outline max-w-xs">{hint}</p>
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-level-1 p-container-margin flex items-start gap-gutter">
      <div className="skeleton w-12 h-12 rounded-lg shrink-0" />
      <div className="flex-1 flex flex-col gap-2 pt-1">
        <div className="skeleton h-4 w-2/3 rounded" />
        <div className="skeleton h-3 w-1/3 rounded" />
      </div>
      <div className="skeleton h-6 w-16 rounded-full shrink-0" />
    </div>
  );
}

export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-stack-md" aria-busy="true" aria-live="polite">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function DemoBanner() {
  return (
    <div className="bg-tertiary-fixed text-on-tertiary-fixed text-label-md px-container-margin py-2 flex items-center gap-2 justify-center">
      <Icon name="science" size={16} />
      Demo mode — showing sample data. Configure Supabase to go live.
    </div>
  );
}
