# Agent Session Changes Tree Sidebar

## Goal

Add a right-side panel to the agent conversation view that displays **changed files in a folder tree structure**. This gives the user real-time visibility into what the agent is modifying — files organized hierarchically (not flat), filtered to only show paths that have git changes (working tree or vs base branch).

This panel mirrors the existing Changes + Files tabs in the terminal workspace view, but merges them into a single unified "changes tree" concept purpose-built for agent sessions.

## Context

### Current state

- **Agent conversation view** (`AgentSessionView`) renders full-width with no right sidebar. It has: tab bar, header with model selector, timeline (messages/activities), and composer.
- **Terminal workspace view** (`MainArea`) has a right panel (`w-96`) with tabs: Settings, Files, Changes, Queue, Linear, Tmux, Review.
  - **Changes tab** (`ChangesPanel`): flat list of changed files with status badges (A/M/D/R/C/U/?), Working/Branch toggle, refresh button.
  - **Files tab** (`FileExplorer`): full project file tree with lazy-loaded expand/collapse directories, file type badges.
- Both views share `WorkspaceSession` which provides a `path` field (the project working directory).

### Why this matters

Agents in agent sessions almost always work on code within a project. Seeing what files are being touched — in context, as a tree — makes the agent conversation feel like an integrated development environment rather than just a chat window.

## Design decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Tree structure | Synthetic tree built from changed file paths | We don't need the full file tree — only folders that contain changes |
| Sidebar visibility | Always visible on wide screens, toggle-able overlay on narrow screens | This is a core part of the agent workflow, not a secondary tool |
| Folder collapsing (single-child) | Not for v1 | Adds complexity; keep it simple first |
| Working/Branch toggle | Yes, same as existing ChangesPanel | Consistent UX with terminal workspace |
| Diff on click | Yes, opens QuickEditDrawer | Leverages existing diff infrastructure |
| Auto-refresh | On window focus + poll while agent is active | Agent sessions mutate files continuously |

## Architecture

### FSD-lite layer placement

```
src/
├── shared/
│   └── api/
│       └── git.api.ts              ← NEW: extracted from main-area (shared git operations)
│   └── lib/
│       └── gitChanges.pure.ts      ← NEW: extracted from main-area (sort, path utils)
│       └── changesTree.pure.ts     ← NEW: build tree from flat change list
│
├── entities/
│   └── (existing types: GitChangeEntry, ChangesMode, GitChangeStatus — already in entities)
│
├── features/
│   └── changes-tree/               ← NEW feature slice
│       ├── index.ts                ← public API
│       ├── ui/
│       │   ├── ChangesTree.container.tsx
│       │   └── ChangesTree.presentational.tsx
│       ├── model/
│       │   └── useChangesTree.ts   ← hook: fetch changes, build tree, manage expand state
│       └── lib/
│           └── changesTree.pure.ts ← (or in shared — see note below)
│
├── widgets/
│   └── agent-session-view/
│       └── ui/
│           ├── AgentSessionView.presentational.tsx  ← MODIFIED: add sidebar layout
│           ├── AgentSessionView.container.tsx        ← MODIFIED: wire sidebar state
│           ├── AgentSessionChangesPanel.container.tsx ← NEW: sidebar container
│           └── AgentSessionView.types.ts             ← MODIFIED: add sidebar props
```

**Note on shared extraction:** The git API functions (`listGitChanges`, `listBranchChanges`, `getBranchDiff`, `getWorkingDiff`) currently live in `src/widgets/main-area/api/mainArea.api.ts`. Since both `main-area` and `agent-session-view` widgets need them, they must move to `src/shared/api/git.api.ts` (widgets cannot import from sibling widgets in FSD-lite). The existing `MainArea` imports should be updated to point to the new shared location. Same applies to `changes.pure.ts` utilities.

### Data flow

```
AgentSessionSnapshot.path (workspace root)
        │
        ▼
  useChangesTree(rootPath, mode)
        │
        ├── listGitChanges(rootPath)     [mode === "working"]
        │   OR
        ├── listBranchChanges(rootPath)  [mode === "branch"]
        │
        ▼
  GitChangeEntry[]  (flat list from Tauri backend)
        │
        ▼
  buildChangesTree(changes)  ← pure function
        │
        ▼
  ChangesTreeNode[]  (nested tree with folders + files)
        │
        ▼
  ChangesTree.presentational renders tree with expand/collapse
        │
        ▼
  User clicks file → onOpenChange(entry) → opens QuickEditDrawer with diff
```

### Core pure function: `buildChangesTree`

Transforms a flat list of `GitChangeEntry` into a nested tree structure.

```typescript
// Input: flat change entries with paths like "src/app/App.tsx", "src/shared/api/fs.api.ts"
// Output: nested tree nodes

interface ChangesTreeFileNode {
  kind: "file";
  name: string;          // "App.tsx"
  path: string;          // "src/app/App.tsx" (relative)
  entry: GitChangeEntry; // original entry with status, staged, etc.
}

interface ChangesTreeFolderNode {
  kind: "folder";
  name: string;          // "app"
  path: string;          // "src/app"
  children: ChangesTreeNode[];
}

type ChangesTreeNode = ChangesTreeFileNode | ChangesTreeFolderNode;

function buildChangesTree(changes: GitChangeEntry[]): ChangesTreeNode[];
```

**Algorithm:**
1. For each change entry, split `entry.path` by `/` to get path segments.
2. Walk the segments, creating folder nodes as needed (like a trie).
3. Insert the file node at the leaf.
4. Sort: folders first, then alphabetical within each level (reuse `sortFileExplorerEntries` pattern).
5. Return the root-level nodes.

**Example:**
```
Input:  ["src/app/App.tsx" (M), "src/shared/api/fs.api.ts" (A), "package.json" (M)]
Output:
├── src/
│   ├── app/
│   │   └── App.tsx [M]
│   └── shared/
│       └── api/
│           └── fs.api.ts [A]
└── package.json [M]
```

This pure function must have thorough unit tests.

## UI specification

### Layout change in AgentSessionView

Current layout (simplified):
```
┌──────────────────────────────────────────┐
│ Tab bar                                   │
├──────────────────────────────────────────┤
│ Header (model selector, stop)             │
│                                           │
│ Timeline (messages, activities)           │
│                                           │
│ Composer (input, attachments)             │
└──────────────────────────────────────────┘
```

New layout:
```
┌──────────────────────────────────────────────────────────┐
│ Tab bar                                          [⎘] btn │
├─────────────────────────────────┬────────────────────────┤
│ Header (model selector, stop)   │ Changes Panel Header   │
│                                 │  [Working] [Branch]    │
│ Timeline                        │  vs main (branch mode) │
│                                 ├────────────────────────┤
│                                 │ ▶ src/                 │
│                                 │   ▶ app/               │
│                                 │     App.tsx [M]        │
│                                 │   ▶ shared/            │
│                                 │     api/               │
│                                 │       fs.api.ts [A]    │
│                                 │ package.json [M]       │
│ Composer                        │                        │
└─────────────────────────────────┴────────────────────────┘
```

### Responsive behavior

| Breakpoint | Behavior |
|------------|----------|
| Wide (>= 1280px, `xl`) | Sidebar always visible, side-by-side with conversation. Sidebar width: `w-80` (320px). |
| Narrow (< 1280px) | Sidebar hidden by default. Toggle button in tab bar area. When toggled, sidebar overlays the conversation as an absolutely-positioned panel with backdrop blur/dim. |

### Sidebar panel components

**Header section:**
- Title: "Changes" (small, subtext style)
- Project name (truncated, from `getBaseName(session.path)`)
- Working/Branch segmented control (reuse `SegmentedControl` from shared)
- Refresh button (reuse `ToolbarButton` from shared)
- In branch mode: show base ref line (e.g., "vs main")

**Tree section:**
- Scrollable area for the tree
- Folder nodes: expand/collapse chevron + folder icon + name
- File nodes: status badge (A/M/D colored) + file type badge + name
- Click on file: triggers `onOpenChange` → opens QuickEditDrawer with diff
- All folders expanded by default (since we only show changed paths, the tree is small)
- Reuse visual patterns from existing `FileExplorer` (indentation, icons, badges)

**Empty states:**
- No changes: "No changes yet." (reuse `EmptyState` component)
- No base branch (branch mode): "No base branch detected."
- Error: reuse `ErrorBanner` component
- Loading: reuse `LoadingSpinner` component

**Status badges** (reuse from `ChangesPanel`):
```
A → green    (Added)
M → yellow   (Modified)
D → red      (Deleted)
R → accent   (Renamed)
C → accent   (Copied)
U → red      (Unmerged)
? → surface  (Untracked)
```

### QuickEditDrawer integration

When a user clicks a changed file in the tree:

1. Container resolves the absolute path: `rootPath + "/" + entry.path`
2. Calls `getWorkingDiff(rootPath, entry.path)` or `getBranchDiff(rootPath, entry.path)` depending on current mode
3. Opens the existing `QuickEditDrawer` with diff view as default tab
4. The drawer already supports `diff`, `diffMode`, `diffLoading`, `diffError` props

**Important:** The `QuickEditDrawer` currently lives in `src/widgets/main-area/ui/`. For v1, the agent session view can import it since the drawer might need to be shared (or extracted). Evaluate during implementation whether the drawer should also move to `src/features/` or `src/shared/`.

### Auto-refresh strategy

- Refresh on window focus (same pattern as existing `ChangesPanel`)
- Poll every ~5 seconds while the agent session status is `"running"` (agent is actively making changes)
- Stop polling when agent is idle/completed
- Manual refresh via the Refresh button

## Implementation plan (ordered steps)

### Step 1: Extract shared git API

Move git operations from widget-scoped to shared scope.

**Create:** `src/shared/api/git.api.ts`
- Move `listBranchChanges`, `listGitChanges`, `getBranchDiff`, `getWorkingDiff` from `src/widgets/main-area/api/mainArea.api.ts`
- Move types: `BranchChangesResponse`, `GitDiffResponse`
- Export from `src/shared/index.ts`

**Create:** `src/shared/lib/gitChanges.pure.ts`
- Move `sortGitChangesByPath`, `getRelativePathFromRoot` from `src/widgets/main-area/lib/changes.pure.ts`
- Export from `src/shared/index.ts`

**Update:** `src/widgets/main-area/api/mainArea.api.ts` → re-export from shared (or update all imports in main-area to point to shared directly)

**Update:** `src/widgets/main-area/ui/ChangesPanel.container.tsx` → update imports to shared

### Step 2: Create `buildChangesTree` pure function

**Create:** `src/shared/lib/changesTree.pure.ts`
- `ChangesTreeNode`, `ChangesTreeFileNode`, `ChangesTreeFolderNode` types
- `buildChangesTree(changes: GitChangeEntry[]): ChangesTreeNode[]` function
- Export from `src/shared/index.ts`

**Create:** `src/shared/lib/__tests__/changesTree.pure.test.ts`
- Test: empty input → empty output
- Test: single file at root → one file node
- Test: nested paths → correct folder nesting
- Test: multiple files in same folder → grouped correctly
- Test: sorting (folders first, then alphabetical)
- Test: preserves `GitChangeEntry` on file nodes
- Test: handles paths with multiple depth levels
- Test: handles renamed files (old_path)

### Step 3: Create `changes-tree` feature slice

**Create:** `src/features/changes-tree/index.ts`

**Create:** `src/features/changes-tree/model/useChangesTree.ts`
- Hook: `useChangesTree(rootPath: string | null, mode: ChangesMode)`
- State: `changes`, `treeNodes`, `loading`, `error`, `baseRef`, `expandedPaths`
- Fetch logic: calls shared git API, runs through `buildChangesTree`
- Expand/collapse: `toggleFolder(path: string)`
- Refresh: `refresh()` callback
- Auto-refresh on window focus
- Returns: `{ treeNodes, loading, error, baseRef, expandedPaths, mode, toggleFolder, refresh, setMode }`

**Create:** `src/features/changes-tree/ui/ChangesTree.presentational.tsx`
- Pure render component — receives tree nodes, expanded state, handlers
- Renders recursive folder/file tree with indentation
- Props: `treeNodes`, `expandedPaths`, `loading`, `error`, `baseRef`, `mode`, `onToggleFolder`, `onOpenFile`, `onModeChange`, `onRefresh`, `rootName`

**Create:** `src/features/changes-tree/ui/ChangesTree.container.tsx`
- Wires `useChangesTree` hook to presentational
- Props: `rootPath`, `onOpenChange`

### Step 4: Add sidebar to AgentSessionView

**Modify:** `src/widgets/agent-session-view/ui/AgentSessionView.types.ts`
- Add to `AgentSessionViewPresentationalProps`:
  - `changesSidebarVisible: boolean`
  - `onToggleChangesSidebar: () => void`
  - `onOpenChangedFile: (entry: GitChangeEntry, mode: ChangesMode) => void`

**Modify:** `src/widgets/agent-session-view/ui/AgentSessionView.container.tsx`
- Add state: `changesSidebarVisible` (default `true`)
- Add toggle handler
- Add `handleOpenChangedFile` → resolve absolute path, fetch diff, open QuickEditDrawer
- Pass new props to presentational

**Modify:** `src/widgets/agent-session-view/ui/AgentSessionView.presentational.tsx`
- Wrap the main content in a flex row
- Add the changes tree sidebar as a sibling flex panel
- Add responsive logic: always visible on `xl+`, overlay toggle on smaller screens
- Add toggle button to the tab bar area

### Step 5: Wire QuickEditDrawer for diff preview

**Modify:** `src/widgets/agent-session-view/ui/AgentSessionView.container.tsx`
- Add diff state: `openDiff`, `diffLoading`, `diffError`, `openFilePath`
- Render `QuickEditDrawer` (or a simplified diff-only variant) when a changed file is clicked
- Use `getBranchDiff` / `getWorkingDiff` from shared API

**Note:** If QuickEditDrawer imports are problematic cross-widget, consider extracting just the diff viewer into shared. Evaluate during implementation.

### Step 6: Add polling for active sessions

**Modify:** `src/features/changes-tree/model/useChangesTree.ts`
- Accept optional `pollWhileActive: boolean` parameter
- When `true`, set up a 5-second interval that calls `refresh()`
- Clean up interval on unmount or when `pollWhileActive` becomes false

**Modify:** `src/widgets/agent-session-view/ui/AgentSessionView.container.tsx`
- Pass `pollWhileActive={session.status === "running"}` to the changes tree

## Key files reference

Files an implementing agent needs to read and understand:

| File | Why |
|------|-----|
| `src/widgets/agent-session-view/ui/AgentSessionView.presentational.tsx` | Main file to modify — add sidebar layout |
| `src/widgets/agent-session-view/ui/AgentSessionView.container.tsx` | Wire sidebar state and handlers |
| `src/widgets/agent-session-view/ui/AgentSessionView.types.ts` | Add new prop types |
| `src/widgets/main-area/ui/ChangesPanel.container.tsx` | Reference for change loading logic and status badges |
| `src/widgets/main-area/ui/FileExplorer.container.tsx` | Reference for tree rendering pattern (indentation, icons, expand/collapse) |
| `src/widgets/main-area/ui/QuickEditDrawer.container.tsx` | Diff drawer to reuse for file click |
| `src/widgets/main-area/api/mainArea.api.ts` | Git API to extract to shared |
| `src/widgets/main-area/lib/changes.pure.ts` | Change utilities to extract to shared |
| `src/widgets/main-area/lib/fileExplorer.pure.ts` | File badge and tree utilities to reuse |
| `src/entities/divergence/model/divergence.types.ts` | `GitChangeEntry`, `ChangesMode`, `GitChangeStatus` types |
| `src/entities/agent-session/model/agentSession.types.ts` | `AgentSessionSnapshot` — has `.path` for workspace root |
| `src/shared/ui/` | Shared components: `Button`, `SegmentedControl`, `EmptyState`, `ErrorBanner`, `LoadingSpinner`, `ToolbarButton` |
| `CLAUDE.md` | Architecture rules, naming conventions, post-task checks |

## Testing requirements

- **Pure tests** (`npm run test:pure`): `buildChangesTree` unit tests
- **Unit tests** (`npm run test:unit`): `useChangesTree` hook behavior (mock git API calls)
- **Architecture** (`chaperone check --fix`): verify no cross-widget imports, shared extractions are clean
- **Lint** (`cargo clippy -- -D warnings`): no Rust changes expected, but run as required

## Out of scope for v1

- Single-child folder collapsing (e.g., `src/shared/api` as one node)
- Inline diff preview within the sidebar (only opens drawer)
- File staging/unstaging from the sidebar
- Commit creation from the sidebar
- File tree for unchanged files (full project explorer in agent view)
- Drag-and-drop or file operations from the tree
