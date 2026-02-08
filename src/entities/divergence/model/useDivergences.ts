import { useCallback, useEffect, useState } from "react";
import type { Divergence } from "./divergence.types";
import {
  deleteDivergence,
  insertDivergence,
  listAllDivergences,
  listDivergencesByProject,
} from "../api/divergence.api";

interface UseDivergencesResult {
  divergences: Divergence[];
  loading: boolean;
  error: string | null;
  addDivergence: (divergence: Omit<Divergence, "id">) => Promise<void>;
  removeDivergence: (id: number) => Promise<void>;
  refresh: () => Promise<void>;
}

interface UseAllDivergencesResult {
  divergencesByProject: Map<number, Divergence[]>;
  loading: boolean;
  refresh: () => Promise<void>;
}

export function useDivergences(projectId: number | null): UseDivergencesResult {
  const [divergences, setDivergences] = useState<Divergence[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (projectId === null) {
      setDivergences([]);
      return;
    }

    try {
      setLoading(true);
      const result = await listDivergencesByProject(projectId);
      setDivergences(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load divergences");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addDivergence = useCallback(async (divergence: Omit<Divergence, "id">) => {
    try {
      await insertDivergence(divergence);
      await refresh();
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : "Failed to add divergence");
    }
  }, [refresh]);

  const removeDivergence = useCallback(async (id: number) => {
    try {
      await deleteDivergence(id);
      await refresh();
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : "Failed to remove divergence");
    }
  }, [refresh]);

  return { divergences, loading, error, addDivergence, removeDivergence, refresh };
}

export function useAllDivergences(): UseAllDivergencesResult {
  const [divergencesByProject, setDivergencesByProject] = useState<Map<number, Divergence[]>>(new Map());
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const result = await listAllDivergences();

      const byProject = new Map<number, Divergence[]>();
      for (const divergence of result) {
        const existing = byProject.get(divergence.project_id) ?? [];
        existing.push(divergence);
        byProject.set(divergence.project_id, existing);
      }
      setDivergencesByProject(byProject);
    } catch (err) {
      console.error("Failed to load divergences:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { divergencesByProject, loading, refresh };
}
