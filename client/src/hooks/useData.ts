import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import * as api from "../api";
import {
  mockAnalysis,
  mockApplications,
  mockDocuments,
  mockTasks,
} from "../data/mock";
import type { Application } from "../types";

interface AsyncState<T> {
  data: T | undefined;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/** Runs an async loader once (and on demand); tracks loading/error. */
function useAsync<T>(loader: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [data, setData] = useState<T>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(() => {
    setLoading(true);
    setError(null);
    loader()
      .then((d) => setData(d))
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(run, [run]);
  return { data, loading, error, reload: run };
}

export function useApplications() {
  const { demoMode } = useAuth();
  return useAsync(
    () => (demoMode ? Promise.resolve(mockApplications) : api.listApplications()),
    [demoMode],
  );
}

export function useApplication(id: string | undefined) {
  const { demoMode } = useAuth();
  return useAsync<Application | null>(
    () => {
      if (!id) return Promise.resolve(null);
      return demoMode
        ? Promise.resolve(mockApplications.find((a) => a.id === id) ?? null)
        : api.getApplication(id);
    },
    [demoMode, id],
  );
}

export function useAnalysis(applicationId: string | undefined) {
  const { demoMode } = useAuth();
  return useAsync(
    () => {
      if (!applicationId) return Promise.resolve(null);
      return demoMode
        ? Promise.resolve(
            mockAnalysis.applicationId === applicationId ? mockAnalysis : null,
          )
        : api.getAnalysisForApplication(applicationId);
    },
    [demoMode, applicationId],
  );
}

export function useTasks() {
  const { demoMode } = useAuth();
  return useAsync(
    () => (demoMode ? Promise.resolve(mockTasks) : api.listTasks()),
    [demoMode],
  );
}

export function useDocuments() {
  const { demoMode } = useAuth();
  return useAsync(
    () => (demoMode ? Promise.resolve(mockDocuments) : api.listDocuments()),
    [demoMode],
  );
}
