import { useEffect, useState } from "react";
import { Icon } from "../components/Icon";
import { EmptyState, ErrorState, Loading } from "../components/states";
import { useApplications, useTasks } from "../hooks/useData";
import { useAuth } from "../auth/AuthContext";
import { setTaskDone } from "../api";
import type { TaskItem } from "../types";

function isToday(iso: string | null): boolean {
  if (!iso) return false;
  return new Date(iso).toDateString() === new Date().toDateString();
}

function TaskCheckbox({
  task,
  onToggle,
}: {
  task: TaskItem;
  onToggle: (id: string) => void;
}) {
  return (
    <button
      onClick={() => onToggle(task.id)}
      className="flex items-start gap-3 w-full text-left group"
    >
      <span
        className={`w-5 h-5 rounded border-2 flex items-center justify-center mt-0.5 transition-colors shrink-0 ${
          task.done
            ? "bg-primary-container border-primary-container"
            : "border-outline-variant group-hover:border-primary-container"
        }`}
      >
        {task.done && <Icon name="check" size={14} className="text-white" />}
      </span>
      <span
        className={`text-body-md transition-colors -mt-0.5 ${
          task.done ? "line-through text-outline" : "text-on-surface"
        }`}
      >
        {task.label}
      </span>
    </button>
  );
}

export function TasksPage() {
  const { demoMode } = useAuth();
  const { data: loaded, loading, error } = useTasks();
  const { data: applications } = useApplications();
  const [tasks, setTasks] = useState<TaskItem[]>([]);

  useEffect(() => {
    if (loaded) setTasks(loaded);
  }, [loaded]);

  async function toggle(id: string) {
    const target = tasks.find((t) => t.id === id);
    if (!target) return;
    const next = !target.done;
    // Optimistic update
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: next } : t)));
    if (!demoMode) {
      try {
        await setTaskDone(id, next);
      } catch {
        setTasks((prev) =>
          prev.map((t) => (t.id === id ? { ...t, done: !next } : t)),
        );
      }
    }
  }

  const apps = applications ?? [];
  const today = tasks.filter((t) => isToday(t.dueDate));
  const upcoming = tasks.filter((t) => !isToday(t.dueDate));

  const renderGroup = (title: string, items: TaskItem[], accent: boolean) => {
    if (items.length === 0) return null;
    const byApp = new Map<string, TaskItem[]>();
    for (const t of items) {
      byApp.set(t.applicationId, [...(byApp.get(t.applicationId) ?? []), t]);
    }
    return (
      <section>
        <h2
          className={`text-label-md uppercase tracking-wider mb-stack-md ${
            accent ? "text-primary" : "text-on-surface-variant"
          }`}
        >
          {title}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter">
          {[...byApp.entries()].map(([appId, appTasks]) => {
            const app = apps.find((a) => a.id === appId);
            return (
              <div
                key={appId}
                className="bg-surface-container-lowest rounded-xl p-5 shadow-level-1 flex flex-col gap-stack-md"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-surface-variant flex items-center justify-center text-label-md text-primary">
                    {app?.company.slice(0, 2).toUpperCase() ?? "?"}
                  </div>
                  <div>
                    <h3 className="text-body-lg font-bold text-on-surface">
                      {app?.company ?? "Application"}
                    </h3>
                    <p className="text-label-sm text-on-surface-variant">
                      {app?.title ?? ""}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col gap-3">
                  {appTasks.map((t) => (
                    <TaskCheckbox key={t.id} task={t} onToggle={toggle} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    );
  };

  return (
    <main className="flex-1 px-container-margin pt-stack-lg pb-stack-xl w-full">
      <div className="mb-stack-lg">
        <h1 className="text-headline-lg-mobile text-on-surface">
          Application Tasks
        </h1>
        <p className="text-body-md text-on-surface-variant mt-unit">
          Stay on top of your ongoing applications.
        </p>
      </div>

      {loading && <Loading label="Loading tasks…" />}
      {error && <ErrorState message={error} />}
      {!loading && !error && tasks.length === 0 && (
        <EmptyState
          icon="checklist"
          title="No tasks yet"
          hint="Tasks are generated automatically when you add an application."
        />
      )}

      <div className="flex flex-col gap-stack-lg">
        {renderGroup("Today", today, true)}
        {renderGroup("Upcoming", upcoming, false)}
      </div>

      <button
        className="fixed bottom-20 right-container-margin w-14 h-14 bg-primary text-on-primary rounded-full shadow-lg flex items-center justify-center z-40 hover:opacity-80 transition-opacity active:scale-90"
        aria-label="Add task"
      >
        <Icon name="add" />
      </button>
    </main>
  );
}
