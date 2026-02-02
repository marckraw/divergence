import { useState, useEffect, useCallback } from "react";
import Database from "@tauri-apps/plugin-sql";
import type { Project, Divergence } from "../types";

let db: Database | null = null;

async function getDb(): Promise<Database> {
  if (!db) {
    db = await Database.load("sqlite:divergence.db");
    // Initialize schema
    await db.execute(`
      CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        path TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    await db.execute(`
      CREATE TABLE IF NOT EXISTS divergences (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        branch TEXT NOT NULL,
        path TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )
    `);
  }
  return db;
}

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProjects = useCallback(async () => {
    try {
      setLoading(true);
      const database = await getDb();
      const result = await database.select<Project[]>(
        "SELECT * FROM projects ORDER BY name"
      );
      setProjects(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load projects");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const addProject = useCallback(async (name: string, path: string) => {
    try {
      const database = await getDb();
      await database.execute(
        "INSERT INTO projects (name, path) VALUES (?, ?)",
        [name, path]
      );
      await loadProjects();
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : "Failed to add project");
    }
  }, [loadProjects]);

  const removeProject = useCallback(async (id: number) => {
    try {
      const database = await getDb();
      // First delete associated divergences
      await database.execute(
        "DELETE FROM divergences WHERE project_id = ?",
        [id]
      );
      await database.execute("DELETE FROM projects WHERE id = ?", [id]);
      await loadProjects();
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : "Failed to remove project");
    }
  }, [loadProjects]);

  return { projects, loading, error, addProject, removeProject, refresh: loadProjects };
}

export function useDivergences(projectId: number | null) {
  const [divergences, setDivergences] = useState<Divergence[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDivergences = useCallback(async () => {
    if (projectId === null) {
      setDivergences([]);
      return;
    }

    try {
      setLoading(true);
      const database = await getDb();
      const result = await database.select<Divergence[]>(
        "SELECT * FROM divergences WHERE project_id = ? ORDER BY created_at DESC",
        [projectId]
      );
      setDivergences(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load divergences");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadDivergences();
  }, [loadDivergences]);

  const addDivergence = useCallback(async (divergence: Omit<Divergence, "id">) => {
    try {
      const database = await getDb();
      await database.execute(
        "INSERT INTO divergences (project_id, name, branch, path, created_at) VALUES (?, ?, ?, ?, ?)",
        [divergence.project_id, divergence.name, divergence.branch, divergence.path, divergence.created_at]
      );
      await loadDivergences();
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : "Failed to add divergence");
    }
  }, [loadDivergences]);

  const removeDivergence = useCallback(async (id: number) => {
    try {
      const database = await getDb();
      await database.execute("DELETE FROM divergences WHERE id = ?", [id]);
      await loadDivergences();
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : "Failed to remove divergence");
    }
  }, [loadDivergences]);

  return { divergences, loading, error, addDivergence, removeDivergence, refresh: loadDivergences };
}

export function useAllDivergences() {
  const [divergencesByProject, setDivergencesByProject] = useState<Map<number, Divergence[]>>(new Map());
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      const database = await getDb();
      const result = await database.select<Divergence[]>(
        "SELECT * FROM divergences ORDER BY created_at DESC"
      );

      const byProject = new Map<number, Divergence[]>();
      for (const div of result) {
        const existing = byProject.get(div.project_id) || [];
        existing.push(div);
        byProject.set(div.project_id, existing);
      }
      setDivergencesByProject(byProject);
    } catch (err) {
      console.error("Failed to load divergences:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  return { divergencesByProject, loading, refresh: loadAll };
}
