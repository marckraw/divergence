# Drizzle ORM Migration Plan

Status: Pending
Owner: TBD
Created: 2026-02-12
Depends on: None (independent initiative, can be done anytime)
Estimated scope: 6 files to migrate, ~52 raw SQL queries to replace

## 1) Why this plan exists

The database layer currently uses raw SQL strings with `@tauri-apps/plugin-sql` directly. There are 52 raw SQL queries scattered across 6 files, with manual row-to-type mapping, no transaction support, inconsistent error handling, and no compile-time query safety. As the app grows (scheduler, more automations, more entities), this becomes a maintenance burden.

Drizzle ORM with its `sqlite-proxy` adapter is the established SOTA pattern for Tauri v2 + SQLite + TypeScript apps. It sits entirely in the TypeScript layer, generates SQL that flows through the same `@tauri-apps/plugin-sql` bridge, and requires zero Rust-side changes.

## 2) Goals

1. Replace all 52 raw SQL strings with type-safe Drizzle queries.
2. Eliminate manual `XyzRow` interfaces and `mapXyzRow()` functions.
3. Add transaction support for multi-step operations (e.g., `deleteProjectWithRelations`).
4. Unify naming conventions (fix the Project/Divergence snake_case inconsistency).
5. Replace PRAGMA-based migration system with Drizzle migrations.
6. Keep the same `@tauri-apps/plugin-sql` backend - no Rust changes.

## 3) Non-goals

1. Changing the Rust backend or `tauri-plugin-sql` configuration.
2. Changing the database file location or format.
3. Adding new tables or changing the schema (schema stays identical).
4. Changing the public API signatures of entity API files (consumers should not need changes).

## 4) Current state audit

### Architecture diagram

```
Current:
  React component → entity.api.ts (raw SQL string) → @tauri-apps/plugin-sql → Rust → SQLite

After migration:
  React component → entity.api.ts (Drizzle query) → Drizzle sqlite-proxy → @tauri-apps/plugin-sql → Rust → SQLite
```

### Files to migrate

| File | Queries | Row types | Notes |
|------|---------|-----------|-------|
| `src/shared/api/database.api.ts` | 7 CREATE TABLE, 3 CREATE INDEX, 5 PRAGMA, 15 ALTER TABLE | None | Schema + migrations |
| `src/entities/automation/api/automation.api.ts` | 12 queries | `AutomationRow`, `AutomationRunRow` + 2 mappers | Has `last_insert_rowid()` workaround |
| `src/entities/inbox-event/api/inboxEvent.api.ts` | 8 queries | `InboxEventRow` + 1 mapper | Unique constraint error handling |
| `src/entities/divergence/api/divergence.api.ts` | 6 queries | None (uses raw snake_case types) | Also uses `last_insert_rowid()` |
| `src/entities/project/api/project.api.ts` | 3 queries | None (uses raw snake_case types) | Non-atomic multi-delete |
| `src/entities/project/lib/projectSettings.ts` | 2 queries | Inline row type | JSON parsing for `copy_ignored_skip` |

### Known issues the migration will fix

1. **No transactions**: `deleteProjectWithRelations()` runs 3 sequential DELETEs - if one fails, data is orphaned.
2. **`last_insert_rowid()` unreliable**: tauri-plugin-sql pools connections. Workaround exists in `automation.api.ts` (query-back by stable attributes), but `divergence.api.ts` and `inboxEvent.api.ts` still use raw `last_insert_rowid()`.
3. **Inconsistent type mapping**: `Project` and `Divergence` types use snake_case (`project_id`, `created_at`, `has_diverged`), while `Automation`, `AutomationRun`, `InboxEvent` use camelCase with explicit row mappers.
4. **Silent migration failures**: All `ALTER TABLE` migrations wrapped in try/catch that only `console.warn`.
5. **No query-time type safety**: If a column is renamed or removed, errors only appear at runtime.
6. **Missing indexes**: No indexes on `project_id` foreign keys in `divergences`, `automations`, `automation_runs`.

## 5) Target setup

### Dependencies to install

```bash
npm install drizzle-orm
npm install -D drizzle-kit
```

No Rust/Cargo changes needed.

### Drizzle proxy driver

Create `src/shared/api/drizzle.api.ts`:

```typescript
import { drizzle } from "drizzle-orm/sqlite-proxy";
import Database from "@tauri-apps/plugin-sql";
import * as schema from "./schema";

let sqliteDb: Database | null = null;

async function getSqlite(): Promise<Database> {
  if (!sqliteDb) {
    sqliteDb = await Database.load("sqlite:divergence.db");
  }
  return sqliteDb;
}

export const db = drizzle(
  async (sql, params, method) => {
    const sqlite = await getSqlite();
    if (/^\s*SELECT\b/i.test(sql)) {
      const rows = await sqlite.select(sql, params);
      return { rows: method === "all" ? rows.map(Object.values) : rows[0] };
    }
    await sqlite.execute(sql, params);
    return { rows: [] };
  },
  { schema }
);
```

**Important**: The proxy driver maps `sqlite.select()` for reads and `sqlite.execute()` for writes. Drizzle generates the SQL, the Tauri plugin executes it - same flow as today but type-safe.

### Schema definitions

Create `src/shared/api/schema.ts` with all table definitions:

```typescript
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

// ── projects ──────────────────────────────────────────
export const projects = sqliteTable("projects", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  path: text("path").notNull().unique(),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

// ── divergences ───────────────────────────────────────
export const divergences = sqliteTable("divergences", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  branch: text("branch").notNull(),
  path: text("path").notNull().unique(),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  hasDiverged: integer("has_diverged", { mode: "boolean" }).notNull().default(false),
});

// ── project_settings ──────────────────────────────────
export const projectSettings = sqliteTable("project_settings", {
  projectId: integer("project_id").primaryKey().references(() => projects.id, { onDelete: "cascade" }),
  copyIgnoredSkip: text("copy_ignored_skip").notNull(),
  useTmux: integer("use_tmux", { mode: "boolean" }).notNull().default(true),
  useWebgl: integer("use_webgl", { mode: "boolean" }).notNull().default(true),
  tmuxHistoryLimit: integer("tmux_history_limit"),
});

// ── automations ───────────────────────────────────────
export const automations = sqliteTable("automations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  agent: text("agent", { enum: ["claude", "codex"] }).notNull(),
  prompt: text("prompt").notNull(),
  intervalHours: integer("interval_hours").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  keepSessionAlive: integer("keep_session_alive", { mode: "boolean" }).notNull().default(false),
  lastRunAtMs: integer("last_run_at_ms"),
  nextRunAtMs: integer("next_run_at_ms"),
  createdAtMs: integer("created_at_ms").notNull(),
  updatedAtMs: integer("updated_at_ms").notNull(),
});

// ── automation_runs ───────────────────────────────────
export const automationRuns = sqliteTable("automation_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  automationId: integer("automation_id").notNull().references(() => automations.id, { onDelete: "cascade" }),
  triggerSource: text("trigger_source", { enum: ["schedule", "manual", "startup_catchup"] }).notNull(),
  status: text("status", { enum: ["queued", "running", "success", "error", "skipped", "cancelled"] }).notNull(),
  startedAtMs: integer("started_at_ms"),
  endedAtMs: integer("ended_at_ms"),
  error: text("error"),
  detailsJson: text("details_json"),
  keepSessionAlive: integer("keep_session_alive", { mode: "boolean" }).notNull().default(false),
  tmuxSessionName: text("tmux_session_name"),
  logFilePath: text("log_file_path"),
  resultFilePath: text("result_file_path"),
});

// ── inbox_events ──────────────────────────────────────
export const inboxEvents = sqliteTable("inbox_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  kind: text("kind").notNull(),
  source: text("source").notNull(),
  projectId: integer("project_id"),
  automationId: integer("automation_id"),
  automationRunId: integer("automation_run_id"),
  externalId: text("external_id").unique(),
  title: text("title").notNull(),
  body: text("body"),
  payloadJson: text("payload_json"),
  read: integer("read", { mode: "boolean" }).notNull().default(false),
  createdAtMs: integer("created_at_ms").notNull(),
});

// ── github_poll_state ─────────────────────────────────
export const githubPollState = sqliteTable("github_poll_state", {
  repoKey: text("repo_key").primaryKey(),
  lastPolledAtMs: integer("last_polled_at_ms").notNull(),
});
```

**Key benefit**: This schema file becomes the single source of truth for both the database structure AND the TypeScript types. Drizzle infers types from the schema - no more manual `XyzRow` interfaces or `mapXyzRow()` functions.

## 6) Migration phases

### Phase 1: Setup Drizzle infrastructure (non-breaking)

**Files to create:**
- `src/shared/api/schema.ts` - all table definitions
- `src/shared/api/drizzle.api.ts` - proxy driver setup
- `drizzle.config.ts` - Drizzle Kit config (for migration generation)

**Files to modify:**
- `package.json` - add `drizzle-orm` and `drizzle-kit` dependencies

**Verification:**
- Drizzle proxy connects to existing database
- A test query (`db.select().from(projects)`) returns correct data
- Existing raw SQL queries still work (no breaking changes yet)

### Phase 2: Migrate entity API files (one at a time)

Migrate each entity file independently. For each file:
1. Replace raw SQL queries with Drizzle query builder calls
2. Remove `XyzRow` interface and `mapXyzRow()` function
3. Keep the same exported function signatures (no consumer changes)
4. Run tests after each file

**Migration order** (easiest to hardest):

#### 2a. `src/entities/project/api/project.api.ts` (3 queries)

Before:
```typescript
export async function listProjects(): Promise<Project[]> {
  const database = await getDb();
  return database.select<Project[]>("SELECT * FROM projects ORDER BY name");
}
```

After:
```typescript
export async function listProjects(): Promise<Project[]> {
  return db.select().from(projects).orderBy(projects.name);
}
```

**Special attention**: `deleteProjectWithRelations()` should be wrapped in a transaction:
```typescript
export async function deleteProjectWithRelations(projectId: number): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(divergences).where(eq(divergences.projectId, projectId));
    await tx.delete(projectSettings).where(eq(projectSettings.projectId, projectId));
    await tx.delete(projects).where(eq(projects.id, projectId));
  });
}
```

**Type change needed**: `Project` type currently uses snake_case (`project_id`, `created_at`). After migration, Drizzle will return camelCase. Update `src/entities/project/model/project.types.ts` and all consumers.

#### 2b. `src/entities/divergence/api/divergence.api.ts` (6 queries)

**Special attention**:
- `Divergence` type also uses snake_case - needs the same camelCase update as `Project`
- `insertDivergenceAndGetId()` uses `last_insert_rowid()` - Drizzle's `.returning()` may work, or use the same stable-query workaround

#### 2c. `src/entities/project/lib/projectSettings.ts` (2 queries)

**Special attention**:
- `copy_ignored_skip` is stored as JSON string, loaded with `JSON.parse()`
- After migration, still need to handle JSON serialization/deserialization manually
- Upsert uses `ON CONFLICT` - Drizzle supports this via `.onConflictDoUpdate()`

#### 2d. `src/entities/inbox-event/api/inboxEvent.api.ts` (8 queries)

**Special attention**:
- Unique constraint error handling (`external_id`) - Drizzle's `.onConflictDoNothing()` can replace the try/catch
- Multiple filter variants in `listInboxEvents()` - use Drizzle's conditional `.where()` builder
- `last_insert_rowid()` usage needs same handling as other entities

#### 2e. `src/entities/automation/api/automation.api.ts` (12 queries, most complex)

**Special attention**:
- Already has the `last_insert_rowid()` workaround with stable-query fallback - preserve this pattern or replace with Drizzle's `.returning()` if it works with the proxy
- `insertAutomationRun()` has the most complex ID resolution logic
- `markAutomationRunSchedule()` updates the automation's schedule timestamps

### Phase 3: Replace schema initialization and migrations

**File to modify:** `src/shared/api/database.api.ts`

Replace:
- All 7 `CREATE TABLE IF NOT EXISTS` statements
- All 5 `ensure*Columns()` functions with PRAGMA checks
- All 15 `ALTER TABLE` statements
- All 3 `CREATE INDEX` statements

With:
- Drizzle migration runner that applies generated SQL migrations
- Or: keep `CREATE TABLE IF NOT EXISTS` from schema definitions (simpler for desktop app)

**Decision needed**: For a desktop app with local SQLite, the simplest approach may be:
1. Use Drizzle's `drizzle-kit generate` to produce migration SQL files
2. Apply them in order on startup (track applied migrations in a `_migrations` table)
3. Or: continue using `CREATE TABLE IF NOT EXISTS` for initial schema and only use Drizzle migrations for schema changes going forward

### Phase 4: Cleanup

1. Remove `getDb()` singleton from `database.api.ts` (replaced by Drizzle's proxy)
2. Remove all `XyzRow` interfaces from entity API files
3. Remove all `mapXyzRow()` functions
4. Update `Project` and `Divergence` types to use camelCase consistently
5. Add missing indexes (foreign key lookups) to schema
6. Update any imports that referenced the old `getDb`

## 7) Type changes required

### Project type (snake_case -> camelCase)

Current (`src/entities/project/model/project.types.ts`):
```typescript
export interface Project {
  id: number;
  name: string;
  path: string;
  created_at: string;  // snake_case!
}
```

After:
```typescript
export interface Project {
  id: number;
  name: string;
  path: string;
  createdAt: string;  // camelCase, inferred from Drizzle schema
}
```

**Impact**: Every file that reads `project.created_at` must change to `project.createdAt`. Search for `created_at` usage across all TS files.

### Divergence type (snake_case -> camelCase)

Current (`src/entities/divergence/model/divergence.types.ts`):
```typescript
export interface Divergence {
  id: number;
  project_id: number;   // snake_case!
  name: string;
  branch: string;
  path: string;
  created_at: string;   // snake_case!
  has_diverged: number;  // snake_case AND number instead of boolean!
}
```

After:
```typescript
export interface Divergence {
  id: number;
  projectId: number;     // camelCase
  name: string;
  branch: string;
  path: string;
  createdAt: string;     // camelCase
  hasDiverged: boolean;  // camelCase + proper boolean
}
```

**Impact**: Every file that reads `divergence.project_id`, `divergence.created_at`, or `divergence.has_diverged` must be updated. Search across all TS files.

### Other types

`Automation`, `AutomationRun`, `InboxEvent`, `ProjectSettings` already use camelCase - no changes needed for these. Their manual `XyzRow` interfaces and mappers just get deleted.

## 8) Indexes to add

The current schema is missing indexes on frequently queried foreign keys:

```typescript
// Add to schema.ts or as a separate migration:
// divergences: project_id lookups
CREATE INDEX IF NOT EXISTS idx_divergences_project_id ON divergences(project_id);

// automations: project_id lookups
CREATE INDEX IF NOT EXISTS idx_automations_project_id ON automations(project_id);

// automation_runs: already has idx_automation_runs_automation_id (good)

// inbox_events: already has idx_inbox_events_created_at and idx_inbox_events_external_id (good)
```

## 9) Testing strategy

1. **Before any migration**: Snapshot the current database state (all tables, all rows).
2. **After each phase**: Verify all entity API functions return identical results.
3. **Specific test cases**:
   - `deleteProjectWithRelations()` with transaction - verify atomicity (trigger an error mid-delete, verify rollback)
   - `insertAutomation()` / `insertAutomationRun()` - verify ID resolution works correctly
   - `insertInboxEvent()` with duplicate `external_id` - verify conflict handling
   - `loadProjectSettings()` - verify JSON parsing still works
   - `listInboxEvents()` with all filter variants

4. **Run existing test suites**: `npm run test:pure` and `npm run test:unit` must pass after each phase.

## 10) Risks and mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Drizzle `sqlite-proxy` row format mismatch | Queries return wrong data | Test each query against raw SQL output before switching |
| `last_insert_rowid()` still broken with Drizzle | Can't get IDs after insert | Keep existing stable-query workaround, test `.returning()` separately |
| Transaction support via proxy may be limited | Multi-step ops still non-atomic | Drizzle proxy supports batch mode for transactions - verify with Tauri plugin |
| `Project`/`Divergence` camelCase rename breaks consumers | Compile errors across codebase | TypeScript compiler will catch all usages; do a global search-replace |
| Migration on existing user databases | Schema mismatch or data loss | Keep `CREATE TABLE IF NOT EXISTS` for backwards compatibility; only add new migrations forward |

## 11) References

- [Drizzle + SQLite in Tauri App](https://huakun.tech/blogs/drizzle-+-sqlite-in-Tauri-App)
- [Tauri + Drizzle Proxy (Kunkun docs)](https://docs.kunkun.sh/blog/tauri--drizzle-proxy/)
- [Drizzle Tauri SQLite Proxy Demo (GitHub)](https://github.com/tdwesten/tauri-drizzle-sqlite-proxy-demo)
- [Drizzle SQLite Migrations in Tauri 2.0](https://keypears.com/blog/2025-10-04-drizzle-sqlite-tauri)
- [Drizzle ORM - SQLite docs](https://orm.drizzle.team/docs/get-started-sqlite)

## 12) File inventory (what gets created/modified/deleted)

### New files
- `src/shared/api/schema.ts` - Drizzle schema definitions (single source of truth)
- `src/shared/api/drizzle.api.ts` - Drizzle proxy driver setup
- `drizzle.config.ts` - Drizzle Kit configuration
- `drizzle/` - Generated migration SQL files (if using Drizzle Kit migrations)

### Modified files
- `package.json` - add `drizzle-orm`, `drizzle-kit`
- `src/shared/api/database.api.ts` - gutted: remove all CREATE TABLE, PRAGMA, ALTER TABLE (may keep for initial bootstrap or replace entirely)
- `src/entities/automation/api/automation.api.ts` - replace 12 raw SQL queries, remove `AutomationRow`, `AutomationRunRow`, `mapAutomationRow`, `mapAutomationRunRow`
- `src/entities/inbox-event/api/inboxEvent.api.ts` - replace 8 raw SQL queries, remove `InboxEventRow`, `mapInboxEventRow`
- `src/entities/divergence/api/divergence.api.ts` - replace 6 raw SQL queries
- `src/entities/project/api/project.api.ts` - replace 3 raw SQL queries, add transaction
- `src/entities/project/lib/projectSettings.ts` - replace 2 raw SQL queries
- `src/entities/project/model/project.types.ts` - `created_at` -> `createdAt` (or remove in favor of Drizzle inferred type)
- `src/entities/divergence/model/divergence.types.ts` - `project_id` -> `projectId`, `created_at` -> `createdAt`, `has_diverged: number` -> `hasDiverged: boolean` (or remove in favor of Drizzle inferred type)
- **All consumers** of `Project` and `Divergence` types that reference snake_case fields

### Deleted code (within modified files)
- `AutomationRow` interface + `mapAutomationRow()` function
- `AutomationRunRow` interface + `mapAutomationRunRow()` function
- `InboxEventRow` interface + `mapInboxEventRow()` function
- All 5 `ensure*Columns()` migration functions
- ~52 raw SQL query strings total
