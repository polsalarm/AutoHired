import { useEffect, useState } from "react";
import { Icon } from "./Icon";
import { Loading } from "./states";
import {
  addTask,
  deleteTask,
  generateAndSaveTasks,
  listTasksForApplication,
  setTaskDone,
} from "../api";
import { mockTasks } from "../data/mock";
import type { TaskItem } from "../types";

interface ChecklistProps {
  applicationId: string;
  appInfo: {
    title: string;
    company: string;
    requirements: string[];
    deadline: string | null;
  };
  userId: string | undefined;
  demoMode: boolean;
}

function fmtDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function Checklist({
  applicationId,
  appInfo,
  userId,
  demoMode,
}: ChecklistProps) {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    const load = demoMode
      ? Promise.resolve(mockTasks.filter((t) => t.applicationId === applicationId))
      : listTasksForApplication(applicationId);
    load
      .then((t) => active && setTasks(t))
      .catch((e) => active && setError((e as Error).message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [applicationId, demoMode]);

  async function generate() {
    setWorking(true);
    setError(null);
    try {
      if (!demoMode && userId) {
        const created = await generateAndSaveTasks(userId, {
          id: applicationId,
          ...appInfo,
        });
        setTasks((prev) => [...prev, ...created]);
      } else {
        // Demo: generate via server but keep local-only
        const res = await fetch("/api/tasks/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(appInfo),
        });
        const { tasks: gen } = (await res.json()) as {
          tasks: { label: string; dueDate: string | null }[];
        };
        setTasks((prev) => [
          ...prev,
          ...gen.map((g, i) => ({
            id: `local-${Date.now()}-${i}`,
            applicationId,
            label: g.label,
            dueDate: g.dueDate,
            done: false,
            source: "ai" as const,
          })),
        ]);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setWorking(false);
    }
  }

  async function toggle(id: string) {
    const target = tasks.find((t) => t.id === id);
    if (!target) return;
    const next = !target.done;
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

  async function add() {
    const label = newLabel.trim();
    if (!label) return;
    setNewLabel("");
    if (!demoMode && userId) {
      try {
        const created = await addTask(userId, applicationId, label, null);
        setTasks((prev) => [...prev, created]);
      } catch (e) {
        setError((e as Error).message);
      }
    } else {
      setTasks((prev) => [
        ...prev,
        {
          id: `local-${Date.now()}`,
          applicationId,
          label,
          dueDate: null,
          done: false,
          source: "manual",
        },
      ]);
    }
  }

  async function remove(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    if (!demoMode && !id.startsWith("local-")) {
      try {
        await deleteTask(id);
      } catch (e) {
        setError((e as Error).message);
      }
    }
  }

  const done = tasks.filter((t) => t.done).length;

  return (
    <section className="bg-surface-container-lowest rounded-xl p-container-margin shadow-level-1 border border-surface-container">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center shrink-0">
            <Icon name="checklist" fill size={18} />
          </div>
          <h3 className="text-body-lg font-semibold text-on-surface">
            Checklist
            {tasks.length > 0 && (
              <span className="text-label-md text-on-surface-variant ml-2">
                {done}/{tasks.length}
              </span>
            )}
          </h3>
        </div>
        {tasks.length > 0 && (
          <button
            onClick={generate}
            disabled={working}
            className="text-label-md text-primary hover:underline flex items-center gap-1 disabled:opacity-50"
          >
            <Icon name={working ? "sync" : "auto_fix_high"} size={16} className={working ? "animate-spin" : ""} />
            Regenerate
          </button>
        )}
      </div>

      {loading && <Loading label="Loading checklist…" />}

      {!loading && tasks.length === 0 && (
        <div className="flex flex-col items-center gap-stack-md py-stack-md text-center">
          <p className="text-body-md text-on-surface-variant">
            No tasks yet. Generate a checklist from this application's requirements.
          </p>
          <button
            onClick={generate}
            disabled={working}
            className="bg-primary text-on-primary px-5 py-3 rounded-lg text-label-md shadow-level-1 hover:bg-on-primary-fixed-variant transition-colors active:scale-95 disabled:opacity-50 flex items-center gap-2"
          >
            <Icon name={working ? "sync" : "auto_fix_high"} size={18} className={working ? "animate-spin" : ""} />
            {working ? "Generating…" : "Generate Checklist"}
          </button>
        </div>
      )}

      {tasks.length > 0 && (
        <ul className="flex flex-col gap-3">
          {tasks.map((t) => (
            <li key={t.id} className="flex items-start gap-3 group">
              <button
                onClick={() => toggle(t.id)}
                className="shrink-0 mt-0.5"
                aria-label={t.done ? "Mark incomplete" : "Mark complete"}
              >
                <span
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                    t.done
                      ? "bg-primary-container border-primary-container"
                      : "border-outline-variant group-hover:border-primary-container"
                  }`}
                >
                  {t.done && <Icon name="check" size={14} className="text-white" />}
                </span>
              </button>
              <div className="flex-1 -mt-0.5">
                <span
                  className={`text-body-md transition-colors ${
                    t.done ? "line-through text-outline" : "text-on-surface"
                  }`}
                >
                  {t.label}
                </span>
                {t.dueDate && (
                  <span className="text-label-sm text-on-surface-variant ml-2">
                    · {fmtDate(t.dueDate)}
                  </span>
                )}
              </div>
              <button
                onClick={() => remove(t.id)}
                className="text-outline hover:text-error transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                aria-label="Delete task"
              >
                <Icon name="close" size={18} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Add manual task */}
      <div className="flex items-center gap-2 mt-4 pt-4 border-t border-surface-container">
        <input
          className="flex-1 bg-surface-container-low rounded-lg px-3 h-10 text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="Add a task…"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <button
          onClick={add}
          className="bg-surface-container-high text-primary rounded-lg w-10 h-10 flex items-center justify-center hover:bg-surface-variant transition-colors active:scale-95"
          aria-label="Add task"
        >
          <Icon name="add" />
        </button>
      </div>

      {error && <p className="text-label-md text-error mt-3">{error}</p>}
    </section>
  );
}
