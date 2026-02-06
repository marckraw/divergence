import Database from "@tauri-apps/plugin-sql";

let db: Database | null = null;

async function ensureProjectSettingsColumns(database: Database): Promise<void> {
  try {
    const columns = await database.select<{ name: string }[]>(
      "PRAGMA table_info(project_settings)"
    );
    const hasUseTmux = columns.some((column) => column.name === "use_tmux");
    const hasUseWebgl = columns.some((column) => column.name === "use_webgl");
    const hasTmuxHistoryLimit = columns.some((column) => column.name === "tmux_history_limit");
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

async function ensureDivergenceColumns(database: Database): Promise<void> {
  try {
    const columns = await database.select<{ name: string }[]>(
      "PRAGMA table_info(divergences)"
    );
    const hasDiverged = columns.some((column) => column.name === "has_diverged");
    if (!hasDiverged) {
      await database.execute(
        "ALTER TABLE divergences ADD COLUMN has_diverged INTEGER NOT NULL DEFAULT 0"
      );
    }
  } catch (err) {
    console.warn("Failed to ensure divergences columns:", err);
  }
}

export async function getDb(): Promise<Database> {
  if (!db) {
    db = await Database.load("sqlite:divergence.db");
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
