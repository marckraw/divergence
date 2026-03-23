# Divergence — Project Summary

## What Is It?

**Divergence** is a cross-platform desktop application (macOS/Linux/Windows) built with **Tauri + React** that turns multi-branch development into a first-class parallel workflow. It lets developers create isolated Git workspace clones (called *divergences*) for different branches of a project, each with its own embedded terminal and AI agent session running side-by-side.

Think of it as a project management hub where each Git branch lives in its own cloned directory, has its own terminal, and can run an AI coding agent — all visible from a single window.

---

## Core Concepts

| Concept | Description |
|---|---|
| **Project** | A Git repository tracked in Divergence |
| **Divergence** | An isolated Git clone of a project for a specific branch/workstream |
| **Workspace Session** | A combined terminal + agent session attached to a divergence |
| **Agent Session** | An AI agent (Claude, Codex, Cursor, Gemini) running inside a divergence |

---

## Tech Stack

### Frontend
- **React 18** + **TypeScript 5** — UI framework
- **Vite 5** — build tool and dev server
- **Tailwind CSS 3** — utility-first styling
- **xterm.js 5** + WebGL addon — full PTY terminal rendering
- **CodeMirror 6** — code editor (JS, Python, Rust, CSS, HTML, JSON, YAML, Markdown)
- **Framer Motion 11** — animations
- **Radix UI** — accessible component primitives (Dialog, Menu, Dropdown, Select, Tooltip…)
- **React Virtuoso** — virtualized lists for performance
- **Zod** — runtime type validation
- **Drizzle ORM** — type-safe SQLite queries

### Backend (Rust via Tauri 2)
- **Tauri 2.10** — native desktop shell, IPC bridge
- **SQLite** (`tauri-plugin-sql`) — local persistence (`~/.divergence/divergence.db`)
- **tauri-plugin-pty** — PTY/terminal sessions
- **tauri-plugin-shell** — shell command execution
- **tokio-tungstenite** — WebSocket server for remote access
- **mdns-sd** — mDNS LAN discovery
- **reqwest** — HTTP client (GitHub, Linear APIs)
- **rusqlite / Drizzle Kit** — database migrations

---

## Key Features

### Multi-Workstream Management
- Add projects and spin up parallel divergences per branch
- Automatic merge detection with cleanup prompts
- Status indicators showing active terminals or agent sessions

### Embedded Terminals
- Full PTY-backed terminal per divergence
- Multiple split panes (vertical and horizontal)
- Tmux integration for persistent sessions

### AI Agent Runtime
- **Multi-provider support:** Claude (local CLI), Codex (App Server), Cursor (headless CLI), Gemini (local CLI)
- Provider-agnostic event system — all agents normalize to a shared event contract
- Plan mode, image/PDF attachment staging, session snapshots & replay
- Prompt queue for batching agent requests

### Code Review & Diffs
- CodeMirror-based viewer with 8+ language syntax highlighting
- Diff review mode for branch changes
- Changes tree showing Git modifications
- File quick-switcher (`Cmd+K`)

### GitHub & Linear Integration
- Fetch, view, and merge pull requests
- Create divergences directly from a PR for review or conflict resolution
- Fetch Linear issues and update workflow states

### Remote Access
- WebSocket server with mDNS discovery for LAN remote sessions
- Authentication layer for remote agent control

---

## Architecture

The codebase follows **FSD-lite** (Feature-Sliced Design, lightweight adaptation) — a layered architecture with strict one-way dependency rules.

```
src/
├── app/          # Bootstrap, global wiring, root App container
├── widgets/      # Screen-level composed sections (sidebar, main area, settings)
├── features/     # 23 user-facing use-cases (agent runtime, PR hub, diff review…)
├── entities/     # 15 business domain models (project, divergence, terminal session…)
└── shared/       # 42 UI components, hooks, utilities, and API adapters
```

**Dependency direction (enforced by Chaperone lint):**
```
app → widgets → features → entities → shared
```
No layer may import from a layer above it. Cross-slice imports go through each slice's `index.ts` public API.

**File naming conventions:**
| Suffix | Role |
|---|---|
| `*.presentational.tsx` | Render-only component — no effects, no IO |
| `*.container.tsx` | Orchestration, state, side-effects |
| `*.api.ts` | Tauri / network IO boundary |
| `*.service.ts` | Side-effectful use-case logic |
| `*.model.ts` / `use*.ts` | State and domain logic |
| `*.pure.ts` | Pure utility functions |
| `*.types.ts` | Local type definitions |

---

## Development

```bash
# Install dependencies
npm install

# Start dev server (Vite + Tauri)
npm run dev

# Run unit tests
npm run test:unit

# Run pure/architecture checks
npm run test:pure

# Architecture lint
chaperone check --fix

# Build for production
npm run build
```

Database migrations are managed via **Drizzle Kit**. The local SQLite database lives at `~/.divergence/divergence.db`, and cloned repos at `~/.divergence/repos/`.

---

## Notable Patterns

- **Presentational/Container split** — render-only components are separated from orchestration, making UI easy to test and reason about.
- **Architecture enforcement** — Chaperone and ESLint custom rules enforce FSD layer boundaries at CI time. Violations are treated as blocking issues.
- **Provider-agnostic agent events** — each AI provider adapter normalizes output into a canonical event stream, so the UI doesn't care which agent is running.
- **PTY over IPC** — terminal sessions use a native Rust PTY bridge (`tauri-plugin-pty`) for real shell behaviour, not a fake command runner.
- **Changesets** for semantic versioning with GitHub release-based auto-updates via `tauri-plugin-updater`.
