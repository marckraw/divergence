import Database from "@tauri-apps/plugin-sql";
import { getMigration13RecoveryAction } from "../lib/databaseMigrations.pure";

// ── Migration types ────────────────────────────────────────────────────────

interface MigrationStatement {
  sql: string;
  /** When true, "duplicate column name" errors are silently ignored. */
  safeAddColumn?: boolean;
}

interface Migration {
  version: number;
  description: string;
  statements: MigrationStatement[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

async function safeAddColumn(database: Database, sql: string): Promise<void> {
  try {
    await database.execute(sql);
  } catch (err: unknown) {
    const msg = String(err);
    if (msg.includes("duplicate column name")) return;
    throw err;
  }
}

async function tableExists(database: Database, tableName: string): Promise<boolean> {
  const rows = await database.select<{ name: string }[]>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = $1 LIMIT 1",
    [tableName],
  );
  return rows.length > 0;
}

async function recoverInterruptedMigration13(
  database: Database,
  currentVersion: number,
): Promise<number> {
  const hasAutomations = await tableExists(database, "automations");
  const hasAutomationsV13 = await tableExists(database, "automations_v13");
  const action = getMigration13RecoveryAction({
    currentVersion,
    hasAutomations,
    hasAutomationsV13,
  });

  if (action === "none") {
    return currentVersion;
  }

  if (action === "drop_stale_v13") {
    await database.execute("DROP TABLE IF EXISTS automations_v13");
    return currentVersion;
  }

  await database.execute("PRAGMA foreign_keys = OFF");
  try {
    await database.execute("ALTER TABLE automations_v13 RENAME TO automations");
    await database.execute(
      "CREATE INDEX IF NOT EXISTS idx_automations_project_id ON automations(project_id)",
    );
    await database.execute(
      "CREATE INDEX IF NOT EXISTS idx_automations_run_mode ON automations(run_mode)",
    );
    await database.execute("INSERT INTO _schema_version (version) VALUES ($1)", [13]);
  } finally {
    await database.execute("PRAGMA foreign_keys = ON");
  }

  return 13;
}

// ── Migrations ─────────────────────────────────────────────────────────────

const MIGRATIONS: Migration[] = [
  {
    version: 1,
    description: "Baseline schema — tables, columns, indexes",
    statements: [
      // ── Tables ────────────────────────────────────────────────────────
      {
        sql: `CREATE TABLE IF NOT EXISTS projects (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          path TEXT NOT NULL UNIQUE,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )`,
      },
      {
        sql: `CREATE TABLE IF NOT EXISTS divergences (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_id INTEGER NOT NULL,
          name TEXT NOT NULL,
          branch TEXT NOT NULL,
          path TEXT NOT NULL UNIQUE,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          has_diverged INTEGER NOT NULL DEFAULT 0,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        )`,
      },
      {
        sql: `CREATE TABLE IF NOT EXISTS project_settings (
          project_id INTEGER PRIMARY KEY,
          copy_ignored_skip TEXT NOT NULL,
          use_tmux INTEGER NOT NULL DEFAULT 1,
          use_webgl INTEGER NOT NULL DEFAULT 1,
          tmux_history_limit INTEGER,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        )`,
      },
      {
        sql: `CREATE TABLE IF NOT EXISTS automations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          project_id INTEGER NOT NULL,
          agent TEXT NOT NULL CHECK(agent IN ('claude', 'codex', 'cursor', 'gemini')),
          prompt TEXT NOT NULL,
          interval_hours INTEGER NOT NULL,
          run_mode TEXT NOT NULL DEFAULT 'schedule' CHECK(run_mode IN ('schedule', 'event')),
          source_project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
          target_project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
          trigger_type TEXT CHECK(trigger_type IN ('github_pr_merged')),
          trigger_config_json TEXT,
          enabled INTEGER NOT NULL DEFAULT 1,
          keep_session_alive INTEGER NOT NULL DEFAULT 0,
          last_run_at_ms INTEGER,
          next_run_at_ms INTEGER,
          created_at_ms INTEGER NOT NULL,
          updated_at_ms INTEGER NOT NULL,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        )`,
      },
      {
        sql: `CREATE TABLE IF NOT EXISTS automation_runs (
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
        )`,
      },
      {
        sql: `CREATE TABLE IF NOT EXISTS inbox_events (
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
        )`,
      },
      {
        sql: `CREATE TABLE IF NOT EXISTS github_poll_state (
          repo_key TEXT PRIMARY KEY,
          last_polled_at_ms INTEGER NOT NULL
        )`,
      },

      // ── Safe column additions (for existing databases) ────────────────
      { sql: "ALTER TABLE project_settings ADD COLUMN use_tmux INTEGER NOT NULL DEFAULT 1", safeAddColumn: true },
      { sql: "ALTER TABLE project_settings ADD COLUMN use_webgl INTEGER NOT NULL DEFAULT 1", safeAddColumn: true },
      { sql: "ALTER TABLE project_settings ADD COLUMN tmux_history_limit INTEGER", safeAddColumn: true },
      { sql: "ALTER TABLE divergences ADD COLUMN has_diverged INTEGER NOT NULL DEFAULT 0", safeAddColumn: true },
      { sql: "ALTER TABLE automations ADD COLUMN last_run_at_ms INTEGER", safeAddColumn: true },
      { sql: "ALTER TABLE automations ADD COLUMN next_run_at_ms INTEGER", safeAddColumn: true },
      { sql: "ALTER TABLE automations ADD COLUMN created_at_ms INTEGER NOT NULL DEFAULT 0", safeAddColumn: true },
      { sql: "ALTER TABLE automations ADD COLUMN updated_at_ms INTEGER NOT NULL DEFAULT 0", safeAddColumn: true },
      { sql: "ALTER TABLE automations ADD COLUMN keep_session_alive INTEGER NOT NULL DEFAULT 0", safeAddColumn: true },
      { sql: "ALTER TABLE automations ADD COLUMN run_mode TEXT NOT NULL DEFAULT 'schedule'", safeAddColumn: true },
      { sql: "ALTER TABLE automations ADD COLUMN source_project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL", safeAddColumn: true },
      { sql: "ALTER TABLE automations ADD COLUMN target_project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL", safeAddColumn: true },
      { sql: "ALTER TABLE automations ADD COLUMN trigger_type TEXT", safeAddColumn: true },
      { sql: "ALTER TABLE automations ADD COLUMN trigger_config_json TEXT", safeAddColumn: true },
      { sql: "ALTER TABLE automation_runs ADD COLUMN tmux_session_name TEXT", safeAddColumn: true },
      { sql: "ALTER TABLE automation_runs ADD COLUMN log_file_path TEXT", safeAddColumn: true },
      { sql: "ALTER TABLE automation_runs ADD COLUMN result_file_path TEXT", safeAddColumn: true },
      { sql: "ALTER TABLE automation_runs ADD COLUMN keep_session_alive INTEGER NOT NULL DEFAULT 0", safeAddColumn: true },
      { sql: "ALTER TABLE inbox_events ADD COLUMN read INTEGER NOT NULL DEFAULT 0", safeAddColumn: true },
      { sql: "ALTER TABLE inbox_events ADD COLUMN created_at_ms INTEGER NOT NULL DEFAULT 0", safeAddColumn: true },

      // ── Indexes ───────────────────────────────────────────────────────
      { sql: "CREATE UNIQUE INDEX IF NOT EXISTS idx_inbox_events_external_id ON inbox_events(external_id) WHERE external_id IS NOT NULL" },
      { sql: "CREATE INDEX IF NOT EXISTS idx_inbox_events_created_at ON inbox_events(created_at_ms DESC)" },
      { sql: "CREATE INDEX IF NOT EXISTS idx_automation_runs_automation_id ON automation_runs(automation_id, id DESC)" },
      { sql: "CREATE INDEX IF NOT EXISTS idx_divergences_project_id ON divergences(project_id)" },
      { sql: "CREATE INDEX IF NOT EXISTS idx_automations_project_id ON automations(project_id)" },
      { sql: "CREATE INDEX IF NOT EXISTS idx_automations_run_mode ON automations(run_mode)" },
    ],
  },
  {
    version: 2,
    description: "Add archived column to automation_runs",
    statements: [
      { sql: "ALTER TABLE automation_runs ADD COLUMN archived INTEGER NOT NULL DEFAULT 0", safeAddColumn: true },
    ],
  },
  {
    version: 3,
    description: "Add divergence_id to automation_runs",
    statements: [
      { sql: "ALTER TABLE automation_runs ADD COLUMN divergence_id INTEGER REFERENCES divergences(id) ON DELETE SET NULL", safeAddColumn: true },
    ],
  },
  {
    version: 4,
    description: "Add workspaces and workspace_members tables",
    statements: [
      {
        sql: `CREATE TABLE IF NOT EXISTS workspaces (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          slug TEXT NOT NULL UNIQUE,
          description TEXT,
          folder_path TEXT NOT NULL UNIQUE,
          created_at_ms INTEGER NOT NULL,
          updated_at_ms INTEGER NOT NULL
        )`,
      },
      {
        sql: `CREATE TABLE IF NOT EXISTS workspace_members (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          workspace_id INTEGER NOT NULL,
          project_id INTEGER NOT NULL,
          added_at_ms INTEGER NOT NULL,
          FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
          UNIQUE(workspace_id, project_id)
        )`,
      },
      { sql: "CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace_id ON workspace_members(workspace_id)" },
      { sql: "CREATE INDEX IF NOT EXISTS idx_workspace_members_project_id ON workspace_members(project_id)" },
    ],
  },
  {
    version: 5,
    description: "Add workspace_id to automations",
    statements: [
      { sql: "ALTER TABLE automations ADD COLUMN workspace_id INTEGER REFERENCES workspaces(id) ON DELETE SET NULL", safeAddColumn: true },
    ],
  },
  {
    version: 6,
    description: "Add workspace_id to inbox_events",
    statements: [
      { sql: "ALTER TABLE inbox_events ADD COLUMN workspace_id INTEGER", safeAddColumn: true },
    ],
  },
  {
    version: 7,
    description: "Add workspace_divergences table",
    statements: [
      {
        sql: `CREATE TABLE IF NOT EXISTS workspace_divergences (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          branch TEXT NOT NULL,
          folder_path TEXT NOT NULL UNIQUE,
          created_at_ms INTEGER NOT NULL
        )`,
      },
      { sql: "CREATE INDEX IF NOT EXISTS idx_workspace_divergences_workspace_id ON workspace_divergences(workspace_id)" },
    ],
  },
  {
    version: 8,
    description: "Add port_allocations table and port columns to project_settings",
    statements: [
      {
        sql: `CREATE TABLE IF NOT EXISTS port_allocations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          entity_type TEXT NOT NULL CHECK(entity_type IN ('project', 'divergence', 'workspace_divergence')),
          entity_id INTEGER NOT NULL,
          project_id INTEGER,
          port INTEGER NOT NULL,
          framework TEXT,
          proxy_hostname TEXT,
          created_at_ms INTEGER NOT NULL,
          UNIQUE(entity_type, entity_id)
        )`,
      },
      { sql: "CREATE INDEX IF NOT EXISTS idx_port_alloc_entity ON port_allocations(entity_type, entity_id)" },
      { sql: "CREATE INDEX IF NOT EXISTS idx_port_alloc_project ON port_allocations(project_id)" },
      { sql: "CREATE UNIQUE INDEX IF NOT EXISTS idx_port_alloc_port ON port_allocations(port)" },
      { sql: "ALTER TABLE project_settings ADD COLUMN default_port INTEGER", safeAddColumn: true },
      { sql: "ALTER TABLE project_settings ADD COLUMN framework TEXT", safeAddColumn: true },
    ],
  },
  {
    version: 9,
    description: "Add workspace_settings table",
    statements: [
      {
        sql: `CREATE TABLE IF NOT EXISTS workspace_settings (
          workspace_id INTEGER PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
          default_port INTEGER,
          framework TEXT
        )`,
      },
    ],
  },
  {
    version: 10,
    description: "Add event-driven automation columns and trigger dispatch table",
    statements: [
      { sql: "ALTER TABLE automations ADD COLUMN run_mode TEXT NOT NULL DEFAULT 'schedule'", safeAddColumn: true },
      { sql: "ALTER TABLE automations ADD COLUMN source_project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL", safeAddColumn: true },
      { sql: "ALTER TABLE automations ADD COLUMN target_project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL", safeAddColumn: true },
      { sql: "ALTER TABLE automations ADD COLUMN trigger_type TEXT", safeAddColumn: true },
      { sql: "ALTER TABLE automations ADD COLUMN trigger_config_json TEXT", safeAddColumn: true },
      {
        sql: `CREATE TABLE IF NOT EXISTS automation_trigger_dispatches (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          automation_id INTEGER NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
          external_event_id TEXT NOT NULL,
          status TEXT NOT NULL CHECK(status IN ('pending', 'launched', 'skipped', 'error')),
          automation_run_id INTEGER REFERENCES automation_runs(id) ON DELETE SET NULL,
          error TEXT,
          created_at_ms INTEGER NOT NULL,
          updated_at_ms INTEGER NOT NULL
        )`,
      },
      { sql: "CREATE UNIQUE INDEX IF NOT EXISTS idx_auto_trigger_dispatch_unique ON automation_trigger_dispatches(automation_id, external_event_id)" },
      { sql: "CREATE INDEX IF NOT EXISTS idx_auto_trigger_dispatch_created_at ON automation_trigger_dispatches(created_at_ms)" },
      { sql: "CREATE INDEX IF NOT EXISTS idx_automations_run_mode ON automations(run_mode)" },
    ],
  },
  {
    version: 11,
    description: "Add persisted prompt queue items",
    statements: [
      {
        sql: `CREATE TABLE IF NOT EXISTS prompt_queue_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          scope_type TEXT NOT NULL CHECK(scope_type IN ('project', 'workspace')),
          scope_id INTEGER NOT NULL,
          prompt TEXT NOT NULL,
          created_at_ms INTEGER NOT NULL
        )`,
      },
      { sql: "CREATE INDEX IF NOT EXISTS idx_prompt_queue_scope_created ON prompt_queue_items(scope_type, scope_id, created_at_ms, id)" },
    ],
  },
  {
    version: 12,
    description: "Add remote access settings and sessions tables",
    statements: [
      {
        sql: `CREATE TABLE IF NOT EXISTS remote_access_settings (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          enabled INTEGER NOT NULL DEFAULT 0,
          port INTEGER NOT NULL DEFAULT 9347,
          master_token_hash TEXT,
          pairing_code TEXT,
          pairing_code_expires_ms INTEGER,
          pairing_attempts INTEGER NOT NULL DEFAULT 0,
          created_at_ms INTEGER NOT NULL
        )`,
      },
      {
        sql: `CREATE TABLE IF NOT EXISTS remote_sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          device_name TEXT NOT NULL,
          session_token_hash TEXT NOT NULL UNIQUE,
          paired_at_ms INTEGER NOT NULL,
          last_seen_ms INTEGER NOT NULL,
          revoked INTEGER NOT NULL DEFAULT 0
        )`,
      },
    ],
  },
  {
    version: 13,
    description: "Expand automation agent enum for Cursor and Gemini",
    statements: [
      { sql: "PRAGMA foreign_keys = OFF" },
      {
        sql: `CREATE TABLE IF NOT EXISTS automations_v13 (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          project_id INTEGER NOT NULL,
          agent TEXT NOT NULL CHECK(agent IN ('claude', 'codex', 'cursor', 'gemini')),
          prompt TEXT NOT NULL,
          interval_hours INTEGER NOT NULL,
          run_mode TEXT NOT NULL DEFAULT 'schedule' CHECK(run_mode IN ('schedule', 'event')),
          source_project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
          target_project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
          trigger_type TEXT CHECK(trigger_type IN ('github_pr_merged')),
          trigger_config_json TEXT,
          enabled INTEGER NOT NULL DEFAULT 1,
          keep_session_alive INTEGER NOT NULL DEFAULT 0,
          last_run_at_ms INTEGER,
          next_run_at_ms INTEGER,
          created_at_ms INTEGER NOT NULL,
          updated_at_ms INTEGER NOT NULL,
          workspace_id INTEGER REFERENCES workspaces(id) ON DELETE SET NULL,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        )`,
      },
      {
        sql: `INSERT INTO automations_v13 (
          id, name, project_id, agent, prompt, interval_hours, run_mode, source_project_id,
          target_project_id, trigger_type, trigger_config_json, enabled, keep_session_alive,
          last_run_at_ms, next_run_at_ms, created_at_ms, updated_at_ms, workspace_id
        )
        SELECT
          id, name, project_id, agent, prompt, interval_hours, run_mode, source_project_id,
          target_project_id, trigger_type, trigger_config_json, enabled, keep_session_alive,
          last_run_at_ms, next_run_at_ms, created_at_ms, updated_at_ms, workspace_id
        FROM automations`,
      },
      { sql: "DROP TABLE automations" },
      { sql: "ALTER TABLE automations_v13 RENAME TO automations" },
      { sql: "CREATE INDEX IF NOT EXISTS idx_automations_project_id ON automations(project_id)" },
      { sql: "CREATE INDEX IF NOT EXISTS idx_automations_run_mode ON automations(run_mode)" },
      { sql: "PRAGMA foreign_keys = ON" },
    ],
  },
];

// ── Migration runner ───────────────────────────────────────────────────────

async function runMigrations(database: Database): Promise<void> {
  await database.execute(
    "CREATE TABLE IF NOT EXISTS _schema_version (version INTEGER NOT NULL)",
  );

  const rows = await database.select<{ version: number }[]>(
    "SELECT version FROM _schema_version ORDER BY version DESC LIMIT 1",
  );
  let currentVersion = rows.length > 0 ? rows[0].version : 0;
  currentVersion = await recoverInterruptedMigration13(database, currentVersion);

  for (const migration of MIGRATIONS) {
    if (migration.version <= currentVersion) continue;

    for (const stmt of migration.statements) {
      if (stmt.safeAddColumn) {
        await safeAddColumn(database, stmt.sql);
      } else {
        await database.execute(stmt.sql);
      }
    }

    await database.execute("INSERT INTO _schema_version (version) VALUES ($1)", [
      migration.version,
    ]);
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

let db: Database | null = null;

export async function getDb(): Promise<Database> {
  if (!db) {
    db = await Database.load("sqlite:divergence.db");
    await db.execute("PRAGMA foreign_keys = ON");
    await runMigrations(db);
  }
  return db;
}
