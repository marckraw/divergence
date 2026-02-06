import { useCallback, useEffect, useState } from "react";
import type { Project } from "./project.types";
import {
  deleteProjectWithRelations,
  insertProject,
  listProjects,
} from "../api/project.api";

interface UseProjectsResult {
  projects: Project[];
  loading: boolean;
  error: string | null;
  addProject: (name: string, path: string) => Promise<void>;
  removeProject: (id: number) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useProjects(): UseProjectsResult {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const result = await listProjects();
      setProjects(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load projects");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addProject = useCallback(async (name: string, path: string) => {
    try {
      await insertProject(name, path);
      await refresh();
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : "Failed to add project");
    }
  }, [refresh]);

  const removeProject = useCallback(async (id: number) => {
    try {
      await deleteProjectWithRelations(id);
      await refresh();
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : "Failed to remove project");
    }
  }, [refresh]);

  return { projects, loading, error, addProject, removeProject, refresh };
}
