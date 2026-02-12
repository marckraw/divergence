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

async function ensureAutomationColumns(database: Database): Promise<void> {
  try {
    const columns = await database.select<{ name: string }[]>(
      "PRAGMA table_info(automations)"
    );
    if (columns.length === 0) {
      return;
    }
    const hasLastRunAtMs = columns.some((column) => column.name === "last_run_at_ms");
    const hasNextRunAtMs = columns.some((column) => column.name === "next_run_at_ms");
    const hasCreatedAtMs = columns.some((column) => column.name === "created_at_ms");
    const hasUpdatedAtMs = columns.some((column) => column.name === "updated_at_ms");
    const hasKeepSessionAlive = columns.some((column) => column.name === "keep_session_alive");

    if (!hasLastRunAtMs) {
      await database.execute(
        "ALTER TABLE automations ADD COLUMN last_run_at_ms INTEGER"
      );
    }
    if (!hasNextRunAtMs) {
      await database.execute(
        "ALTER TABLE automations ADD COLUMN next_run_at_ms INTEGER"
      );
    }
    if (!hasCreatedAtMs) {
      await database.execute(
        "ALTER TABLE automations ADD COLUMN created_at_ms INTEGER NOT NULL DEFAULT 0"
      );
    }
    if (!hasUpdatedAtMs) {
      await database.execute(
        "ALTER TABLE automations ADD COLUMN updated_at_ms INTEGER NOT NULL DEFAULT 0"
      );
    }
    if (!hasKeepSessionAlive) {
      await database.execute(
        "ALTER TABLE automations ADD COLUMN keep_session_alive INTEGER NOT NULL DEFAULT 0"
      );
    }
  } catch (err) {
    console.warn("Failed to ensure automations columns:", err);
  }
}

async function ensureAutomationRunColumns(database: Database): Promise<void> {
  try {
    const columns = await database.select<{ name: string }[]>(
      "PRAGMA table_info(automation_runs)"
    );
    if (columns.length === 0) {
      return;
    }
    const hasTmuxSessionName = columns.some((column) => column.name === "tmux_session_name");
    const hasLogFilePath = columns.some((column) => column.name === "log_file_path");
    const hasResultFilePath = columns.some((column) => column.name === "result_file_path");
    const hasKeepSessionAlive = columns.some((column) => column.name === "keep_session_alive");

    if (!hasTmuxSessionName) {
      await database.execute(
        "ALTER TABLE automation_runs ADD COLUMN tmux_session_name TEXT"
      );
    }
    if (!hasLogFilePath) {
      await database.execute(
        "ALTER TABLE automation_runs ADD COLUMN log_file_path TEXT"
      );
    }
    if (!hasResultFilePath) {
      await database.execute(
        "ALTER TABLE automation_runs ADD COLUMN result_file_path TEXT"
      );
    }
    if (!hasKeepSessionAlive) {
      await database.execute(
        "ALTER TABLE automation_runs ADD COLUMN keep_session_alive INTEGER NOT NULL DEFAULT 0"
      );
    }
  } catch (err) {
    console.warn("Failed to ensure automation_runs columns:", err);
  }
}

async function ensureInboxColumns(database: Database): Promise<void> {
  try {
    const columns = await database.select<{ name: string }[]>(
      "PRAGMA table_info(inbox_events)"
    );
    if (columns.length === 0) {
      return;
    }
    const hasRead = columns.some((column) => column.name === "read");
    const hasCreatedAtMs = columns.some((column) => column.name === "created_at_ms");
    if (!hasRead) {
      await database.execute(
        "ALTER TABLE inbox_events ADD COLUMN read INTEGER NOT NULL DEFAULT 0"
      );
    }
    if (!hasCreatedAtMs) {
      await database.execute(
        "ALTER TABLE inbox_events ADD COLUMN created_at_ms INTEGER NOT NULL DEFAULT 0"
      );
    }
  } catch (err) {
    console.warn("Failed to ensure inbox_events columns:", err);
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
    await db.execute(`
      CREATE TABLE IF NOT EXISTS automations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        project_id INTEGER NOT NULL,
        agent TEXT NOT NULL CHECK(agent IN ('claude', 'codex')),
        prompt TEXT NOT NULL,
        interval_hours INTEGER NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        keep_session_alive INTEGER NOT NULL DEFAULT 0,
        last_run_at_ms INTEGER,
        next_run_at_ms INTEGER,
        created_at_ms INTEGER NOT NULL,
        updated_at_ms INTEGER NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )
    `);
    await db.execute(`
      CREATE TABLE IF NOT EXISTS automation_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        automation_id INTEGER NOT NULL,
        trigger_source TEXT NOT NULL CHECK(trigger_source IN ('schedule', 'manual', 'startup_catchup')),
        status TEXT NOT NULL CHECK(status IN ('queued', 'running', 'success', 'error', 'skipped', 'cancelled')),
        started_at_ms INTEGER,
        ended_at_ms INTEGER,
        error TEXT,
        details_json TEXT,
        keep_session_alive INTEGER NOT NULL DEFAULT 0,
        tmux_session_name TEXT,
        log_file_path TEXT,
        result_file_path TEXT,
        FOREIGN KEY (automation_id) REFERENCES automations(id) ON DELETE CASCADE
      )
    `);
    await db.execute(`
      CREATE TABLE IF NOT EXISTS inbox_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kind TEXT NOT NULL,
        source TEXT NOT NULL,
        project_id INTEGER,
        automation_id INTEGER,
        automation_run_id INTEGER,
        external_id TEXT,
        title TEXT NOT NULL,
        body TEXT,
        payload_json TEXT,
        read INTEGER NOT NULL DEFAULT 0,
        created_at_ms INTEGER NOT NULL
      )
    `);
    await db.execute(
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_inbox_events_external_id ON inbox_events(external_id) WHERE external_id IS NOT NULL"
    );
    await db.execute(
      "CREATE INDEX IF NOT EXISTS idx_inbox_events_created_at ON inbox_events(created_at_ms DESC)"
    );
    await db.execute(
      "CREATE INDEX IF NOT EXISTS idx_automation_runs_automation_id ON automation_runs(automation_id, id DESC)"
    );
    await db.execute(
      "CREATE TABLE IF NOT EXISTS github_poll_state (repo_key TEXT PRIMARY KEY, last_polled_at_ms INTEGER NOT NULL)"
    );
    await ensureProjectSettingsColumns(db);
    await ensureDivergenceColumns(db);
    await ensureAutomationColumns(db);
    await ensureAutomationRunColumns(db);
    await ensureInboxColumns(db);
  }
  return db;
}
