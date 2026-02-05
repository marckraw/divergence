import { useState, useEffect, useCallback } from "react";
import Database from "@tauri-apps/plugin-sql";
import type { Project, Divergence } from "../types";

let db: Database | null = null;

export async function getDb(): Promise<Database> {
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
        has_diverged INTEGER NOT NULL DEFAULT 0,
        mode TEXT NOT NULL DEFAULT 'clone',
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )
    `);
    await db.execute(`
      CREATE TABLE IF NOT EXISTS project_settings (
        project_id INTEGER PRIMARY KEY,
        copy_ignored_skip TEXT NOT NULL,
        use_tmux INTEGER NOT NULL DEFAULT 1,
        use_webgl INTEGER NOT NULL DEFAULT 1,
        tmux_history_limit INTEGER,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )
    `);
    await ensureProjectSettingsColumns(db);
    await ensureDivergenceColumns(db);
  }
  return db;
}

async function ensureProjectSettingsColumns(database: Database) {
  try {
    const columns = await database.select<{ name: string }[]>(
      "PRAGMA table_info(project_settings)"
    );
    const hasUseTmux = columns.some(column => column.name === "use_tmux");
    const hasUseWebgl = columns.some(column => column.name === "use_webgl");
    const hasTmuxHistoryLimit = columns.some(column => column.name === "tmux_history_limit");
    if (!hasUseTmux) {
      await database.execute(
        "ALTER TABLE project_settings ADD COLUMN use_tmux INTEGER NOT NULL DEFAULT 1"
      );
    }
    if (!hasUseWebgl) {
      await database.execute(
        "ALTER TABLE project_settings ADD COLUMN use_webgl INTEGER NOT NULL DEFAULT 1"
      );
    }
    if (!hasTmuxHistoryLimit) {
      await database.execute(
        "ALTER TABLE project_settings ADD COLUMN tmux_history_limit INTEGER"
      );
    }
  } catch (err) {
    console.warn("Failed to ensure project_settings columns:", err);
  }
}

async function ensureDivergenceColumns(database: Database) {
  try {
    const columns = await database.select<{ name: string }[]>(
      "PRAGMA table_info(divergences)"
    );
    const hasDiverged = columns.some(column => column.name === "has_diverged");
    const hasMode = columns.some(column => column.name === "mode");
    if (!hasDiverged) {
      await database.execute(
        "ALTER TABLE divergences ADD COLUMN has_diverged INTEGER NOT NULL DEFAULT 0"
      );
    }
    if (!hasMode) {
      await database.execute(
        "ALTER TABLE divergences ADD COLUMN mode TEXT NOT NULL DEFAULT 'clone'"
      );
    }
  } catch (err) {
    console.warn("Failed to ensure divergences columns:", err);
  }
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
      await database.execute(
        "DELETE FROM project_settings WHERE project_id = ?",
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
        "INSERT INTO divergences (project_id, name, branch, path, created_at, has_diverged, mode) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          divergence.project_id,
          divergence.name,
          divergence.branch,
          divergence.path,
          divergence.created_at,
          divergence.has_diverged ?? 0,
          divergence.mode,
        ]
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
