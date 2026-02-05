# Divergence

A Tauri + React desktop app for managing multiple projects, branches, and parallel workstreams with embedded terminals running Claude Code.

## Features

- **Project Management**: Add, remove, and organize your projects in a sidebar
- **Divergences**: Create isolated workspaces (git clones) for different branches
- **Embedded Terminal**: Full terminal with PTY support for each project/divergence
- **Quick Switcher**: Press `Cmd+K` to quickly jump between workspaces
- **Merge Detection**: Automatically detects when branches are merged and prompts for cleanup
- **Status Indicators**: See at a glance which terminals are active or busy

## Tech Stack

- **Frontend**: React + TypeScript + Tailwind CSS
- **Backend**: Tauri 2.0 (Rust)
- **Terminal**: tauri-plugin-pty + xterm.js
- **Database**: SQLite (via tauri-plugin-sql)
- **Storage**: `~/.divergence/` for database and cloned repos

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+K` | Quick Switcher |
| `Cmd+,` | Settings |
| `Cmd+W` | Close Terminal |
| `Cmd+B` | Toggle Left Sidebar |
| `Cmd+Shift+B` | Toggle Right Panel |
| `Cmd+D` | Split Terminal (Vertical) |
| `Cmd+Shift+D` | Split Terminal (Horizontal) |
| `Cmd+1-9` | Switch to Tab |
| `Cmd+[` | Previous Tab |
| `Cmd+]` | Next Tab |

## Development

### Prerequisites

- Node.js 18+
- Rust 1.70+
- macOS (for building macOS apps)

### Setup

```bash
# Install dependencies
npm install

# Run in development mode
npm run tauri dev

# Build for production
npm run tauri build
```

### Project Structure

```
divergence/
├── src/                    # React frontend
│   ├── components/         # UI components
│   ├── hooks/             # Custom React hooks
│   └── types.ts           # TypeScript types
├── src-tauri/             # Rust backend
│   ├── src/
│   │   ├── main.rs        # Entry point
│   │   ├── lib.rs         # Plugin setup
│   │   ├── commands.rs    # Tauri commands
│   │   ├── db.rs          # Database operations
│   │   └── git.rs         # Git operations
│   └── Cargo.toml
└── package.json
```

## Data Storage

Divergence stores data in `~/.divergence/`:

```
~/.divergence/
├── divergence.db          # SQLite database
└── repos/                 # Cloned divergence repos
    ├── project-feature-x-a1b2c3/
    └── project-bugfix-d4e5f6/
```

## License

MIT
