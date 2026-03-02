# SQLite Access Audit (MAR-949)

Updated: 2026-03-02
Owner: MAR-949
Status: Completed audit

## Summary

SQLite access is split across two stacks:

1. TypeScript runtime data access via Drizzle ORM (`drizzle-orm/sqlite-proxy`) over `@tauri-apps/plugin-sql`.
2. Rust WebSocket server/auth modules via direct `rusqlite` queries.

TypeScript entity/feature runtime code is already mostly guarded against raw SQL. Raw SQL still exists in:

1. TypeScript schema/bootstrap migrations (`src/shared/api/database.api.ts`).
2. Rust remote access modules (`src-tauri/src/ws_auth.rs`, `src-tauri/src/ws_server.rs`).

## What We Use To Talk To SQLite

### TypeScript app layer

Primary DB wrapper:

1. [src/shared/api/drizzle.api.ts](/Users/marckraw/Projects/divergence/src/shared/api/drizzle.api.ts)
2. Drizzle generates SQL, then executes via plugin-sql:
   1. `database.select(...)` for reads.
   2. `database.execute(...)` for writes.

Database bootstrap + migrations:

1. [src/shared/api/database.api.ts](/Users/marckraw/Projects/divergence/src/shared/api/database.api.ts)
2. Uses `Database.load("sqlite:divergence.db")` and runs migration SQL statements (12 versions, 63 statements).

Schema source used by Drizzle:

1. [src/shared/api/schema.types.ts](/Users/marckraw/Projects/divergence/src/shared/api/schema.types.ts)

Entity/feature runtime APIs using Drizzle query builder (no raw SQL strings detected in those layers):

1. `src/entities/**/api/*.api.ts`
2. `src/features/remote-access/api/remoteAccess.api.ts`

### Rust side

Direct `rusqlite` access is used by remote access server/auth paths:

1. [src-tauri/src/ws_auth.rs](/Users/marckraw/Projects/divergence/src-tauri/src/ws_auth.rs)
2. [src-tauri/src/ws_server.rs](/Users/marckraw/Projects/divergence/src-tauri/src/ws_server.rs)

Audit count in those files: 28 SQL operation call sites (`prepare/query_map/query_row/execute`).

## Findings

### 1. TypeScript runtime CRUD is already Drizzle-first

Evidence:

1. Drizzle is imported in all active entity/feature DB API modules.
2. Direct plugin-sql import in TS appears only in [database.api.ts](/Users/marckraw/Projects/divergence/src/shared/api/database.api.ts).
3. No raw SQL query strings were found under `src/entities` or `src/features`.

Assessment: good baseline for safety and maintainability in TS runtime code.

### 2. Raw SQL still exists for migrations/bootstrap in TS (expected)

Evidence:

1. Migration DDL/DML is declared as SQL text in [database.api.ts](/Users/marckraw/Projects/divergence/src/shared/api/database.api.ts#L31).
2. Migration runner executes statements directly in [database.api.ts](/Users/marckraw/Projects/divergence/src/shared/api/database.api.ts#L346).

Assessment: acceptable as a controlled exception; this is bootstrap/migration infrastructure, not scattered runtime CRUD.

### 3. Rust remote modules use raw SQL directly

Evidence:

1. Auth table bootstrap and session/pairing queries in [ws_auth.rs](/Users/marckraw/Projects/divergence/src-tauri/src/ws_auth.rs#L23).
2. WebSocket RPC DB handlers in [ws_server.rs](/Users/marckraw/Projects/divergence/src-tauri/src/ws_server.rs#L550).

Assessment:

1. Queries are mostly parameterized (`?1`, `rusqlite::params!`) and not directly interpolating user input.
2. Main concern is maintainability/schema drift, not immediate SQL injection risk.

### 4. Schema duplication risk between TS and Rust

Evidence:

1. `remote_access_settings`/`remote_sessions` are created in TS migration v12:
   [database.api.ts](/Users/marckraw/Projects/divergence/src/shared/api/database.api.ts#L315)
2. The same tables are also created in Rust bootstrap:
   [ws_auth.rs](/Users/marckraw/Projects/divergence/src-tauri/src/ws_auth.rs#L23)

Assessment: medium risk for long-term drift if one side changes schema and the other is not updated.

## Guardrails Updated In This Task

Chaperone rule `no-raw-sql-strings` was tightened:

1. Scope expanded from `src/{entities,features}/**/*` to all `src/**/*.{ts,tsx}`.
2. Explicit exception retained only for [database.api.ts](/Users/marckraw/Projects/divergence/src/shared/api/database.api.ts).

File changed:

1. [\.chaperone.json](/Users/marckraw/Projects/divergence/.chaperone.json)

## Recommendations

1. Keep TS runtime DB access on Drizzle only (already aligned).
2. Treat [database.api.ts](/Users/marckraw/Projects/divergence/src/shared/api/database.api.ts) as the only TS raw SQL exception.
3. Plan a follow-up to reduce Rust-side schema/query duplication, especially for remote access tables.
4. In Rust DB handlers, prefer explicit error propagation over `filter_map(|r| r.ok())` patterns in list handlers to avoid silent row-decode drops.
