# Stage Layout Refactor — Side-by-Side Terminal & Agent Sessions

## Problem Statement

Currently, terminal sessions and agent sessions are rendered in **mutually exclusive views**. The routing in `App.container.tsx` is binary:

- If `activeSession` is an agent → render `<AgentSessionView>`
- If `activeSession` is a terminal → render `<MainArea>`

This makes it impossible to view a terminal and an agent session side by side. The existing split pane system (`SplitSessionState`) only supports terminal-to-terminal splits within `MainArea`.

## Goal

Enable **heterogeneous split panes** in the central content area so that any combination of terminal and agent sessions can be displayed simultaneously (terminal + agent, agent + agent, terminal + terminal).

## Naming Convention

The term **"Workspace"** is already overloaded in this codebase (entity for grouping projects, union type for sessions, session scoping keys). This refactor uses the **"Stage"** naming family to avoid collisions:

| New Concept | Name | Description |
|-------------|------|-------------|
| Layout state | `StageLayout` | Describes how the central stage is split into panes |
| Layout hook | `useStageLayout` | Manages `StageLayout` state |
| Unified container | `<StageView>` | Replaces the binary `AgentSessionView` / `MainArea` routing |
| Individual content area | `<StagePane>` | Renders a terminal or agent session inside a layout pane |
| Entity folder | `src/entities/stage-layout/` | FSD entity for layout types and pure utilities |

## Implementation Note

The original draft placed `<StageView>` under `src/widgets/stage-view/`. During implementation, that conflicted with the repository’s enforced FSD-lite rule that widgets must not import other widgets. Because the stage shell composes the existing terminal and agent widgets, the concrete implementation lives under `src/app/ui/stage-view/`, where app-level composition is allowed.

---

## Current Architecture (What Exists Today)

### Routing (`App.container.tsx`)

```
activeWorkspaceSettingsId !== null
  → <WorkspaceSettings />
sidebarMode === "work"
  → work panels (inbox, prs, task_center, automations, ports, debug)
isAgentSession(activeWorkspaceSession)
  → <AgentSessionView sessionId={...} ... />
else
  → <MainArea activeSession={...} ... />
```

Key variables:
- `workspaceSessions: Map<string, WorkspaceSession>` — merged terminal + agent sessions
- `activeSessionId: string | null` — single active session
- `activeWorkspaceSession = workspaceSessions.get(activeSessionId)`
- Type guard: `isAgentSession()` checks for `kind: "agent"` field

### Terminal Split Panes (`SplitSessionState`)

Located in `src/entities/terminal-session/` and `src/app/lib/splitSession.pure.ts`.

```typescript
interface SplitSessionState {
  orientation: "vertical" | "horizontal"
  paneIds: SplitPaneId[]        // ["pane-1", "pane-2", ...]
  paneSizes?: number[]           // normalized to sum ~1.0
  focusedPaneId: SplitPaneId
  primaryPaneId: SplitPaneId
}
```

- Max 6 panes, all render `<Terminal>` components
- Each secondary pane gets a derived session ID: `${sessionId}-${paneId}`
- Each pane spawns its own tmux session via `buildSplitTmuxSessionName()`
- Pure functions: `buildNextSplitState()`, `focusSplitPane()`, `closeFocusedSplitPane()`, `resizeSplitPaneSizes()`
- State stored in `splitBySessionId: Map<string, SplitSessionState>` (managed by `useSplitPaneManagement`)

### MainArea Widget (`src/widgets/main-area/`)

Renders the terminal-focused view:
- **Toolbar**: sidebar toggle, `<WorkspaceSessionTabs>`, split controls (V/H/Single/Reconnect), usage limits
- **Content**: split pane layout with `<Terminal>` components per pane
- **Right panel**: slide-in panel (w-96) with 7 tabs: Settings, Files, Changes, Queue, Linear, Tmux, Review

### AgentSessionView Widget (`src/widgets/agent-session-view/`)

Renders the agent-focused view:
- **Toolbar**: `<WorkspaceSessionTabs>`, mobile sidebar toggle
- **Content**: message timeline + composer + pending request forms
- **Right sidebar**: 3 tabs: Changes, Linear, Queue (always visible on xl+, modal on mobile)

### Right Sidebar — Differences Between Views

#### Tabs available

| Tab | Terminal (MainArea) | Agent (AgentSessionView) | Shared Component? |
|-----|--------------------|--------------------------|--------------------|
| Settings | Project settings panel | N/A | No — terminal-only |
| Files | File explorer tree | N/A | No — terminal-only |
| Changes | `ChangesPanel` (flat list, manual refresh) | `ChangesTree` (tree view, auto-polls while agent runs) | No — different implementations |
| Queue | `PromptQueuePanel` | `PromptQueuePanel` | **Yes** — same presentational, different hooks |
| Linear | `LinearTaskQueuePanel` | `LinearTaskQueuePanel` | **Yes** — same presentational, different hooks |
| Tmux | Tmux session manager | N/A | No — terminal-only |
| Review | Diff review draft panel | N/A | No — terminal-only |

#### Integration pattern difference

The **same presentational components** (`LinearTaskQueuePanel`, `PromptQueuePanel`) are used in both views, but they are wired through **different hooks** that implement different "send" behaviors:

| Action | Terminal Context | Agent Context |
|--------|-----------------|---------------|
| Send prompt from queue | `onSendPromptToSession(sessionId, prompt)` → writes to PTY | `onSetComposerText(prompt)` → populates composer input |
| Send Linear issue | `onSendPromptToSession(sessionId, buildLinearIssuePrompt(issue))` → writes to PTY | `onSetComposerText(buildLinearIssuePrompt(issue))` → populates composer |
| Error on no session | "No active terminal session. Open a session first." | N/A (always has composer) |

Terminal hooks:
- `usePromptQueue({ queueScope, activePaneSessionIdRef, onSendPromptToSession })`
- `useLinearTaskQueue(...)` — depends on `activePaneSessionIdRef`

Agent hooks:
- `useAgentPromptQueue({ queueScope, onSetComposerText })`
- `useAgentLinearTaskQueue(...)` — depends on `onSetComposerText`

### Terminal Command Registration

Terminal uses an inverted callback pattern:
1. `Terminal.container` spawns PTY and calls `onRegisterCommand(sessionId, sendCommand)`
2. Parent stores the `sendCommand` function in `commandBySessionId: Map`
3. Prompt queue / Linear / keyboard shortcuts call `sendCommandToSession(sessionId, command)`
4. This looks up the stored function and invokes it

Agent sessions don't use this pattern — they call `onSendPrompt(sessionId, prompt)` directly via the agent runtime API.

### Tab Bar

Both views use the **identical** `WorkspaceSessionTabsPresentational` component with the same props. The toolbar is largely duplicated:

- MainArea toolbar: sidebar toggle + tabs + split controls + reconnect + usage limits
- AgentSessionView toolbar: tabs + mobile sidebar toggle

---

## Proposed Architecture

### Phase 1: Extract Embeddable Pane Components

**Goal:** Create headless, embeddable "body" components that can be rendered inside any layout pane without carrying their own toolbar or right sidebar.

#### 1a. `<TerminalPane>` (new component)

Extract from `MainArea` the terminal rendering logic into a standalone pane component.

**Location:** `src/widgets/stage-view/ui/TerminalPane.container.tsx`

**Props:**
```typescript
interface TerminalPaneProps {
  session: TerminalSession
  isFocused: boolean
  onRegisterCommand: (sessionId: string, sendCommand: (cmd: string) => void) => void
  onUnregisterCommand: (sessionId: string) => void
  onStatusChange: (sessionId: string, status: SessionStatus) => void
  onReconnect: (sessionId: string) => void
}
```

**What it renders:** The xterm.js terminal (reuses existing `Terminal.container.tsx` directly — it's already well-encapsulated).

**What it does NOT include:** Toolbar, tab bar, right panel, split controls.

#### 1b. `<AgentPane>` (new component)

Extract from `AgentSessionView` the conversation body into a standalone pane component.

**Location:** `src/widgets/stage-view/ui/AgentPane.container.tsx`

**Props:**
```typescript
interface AgentPaneProps {
  sessionId: string
  isFocused: boolean
  capabilities: AgentRuntimeCapabilities | null
  projects: Project[]
  workspaceMembersByWorkspaceId: Map<number, WorkspaceMember[]>
  onSendPrompt: (sessionId: string, prompt: string, options?: SendPromptOptions) => Promise<void>
  onStageAttachment: (input: StageAttachmentInput) => Promise<AgentRuntimeAttachment>
  onDiscardAttachment: (sessionId: string, attachmentId: string) => Promise<void>
  onRespondToRequest: (sessionId: string, requestId: string, input: RequestResponse) => Promise<void>
  onStopSession: (sessionId: string) => Promise<void>
  onUpdateSessionSettings: (sessionId: string, input: SessionSettingsUpdate) => Promise<void>
  // Callback for sidebar integration:
  onSetComposerText?: (text: string) => void
  composerRef?: React.RefObject<AgentSessionComposerHandle>
}
```

**What it renders:** Model/effort header, message timeline, composer, pending request forms.

**What it does NOT include:** Toolbar, tab bar, right sidebar tabs.

**Internal state:** Uses `useAgentRuntimeSession(sessionId)` for live session data, manages composer state, request resolution state.

### Phase 2: `StageLayout` Entity

**Goal:** Define the layout state type and pure utility functions.

**Location:** `src/entities/stage-layout/`

```
src/entities/stage-layout/
  index.ts                           # Public API
  model/
    stageLayout.types.ts             # Types
  lib/
    stageLayout.pure.ts              # Pure layout operations
    stagePaneId.pure.ts              # Pane ID constants
```

#### Types (`stageLayout.types.ts`)

```typescript
export type StagePaneId = "stage-pane-1" | "stage-pane-2" | "stage-pane-3" | "stage-pane-4"

export type StagePaneRef =
  | { kind: "terminal"; sessionId: string }
  | { kind: "agent"; sessionId: string }

export interface StagePane {
  id: StagePaneId
  ref: StagePaneRef
}

export interface StageLayout {
  orientation: "horizontal" | "vertical"
  panes: StagePane[]
  paneSizes: number[]             // normalized to sum ~1.0
  focusedPaneId: StagePaneId
}

export type StageLayoutAction =
  | { type: "split"; sessionId: string; orientation: "horizontal" | "vertical" }
  | { type: "focus"; paneId: StagePaneId }
  | { type: "close"; paneId: StagePaneId }
  | { type: "resize"; paneSizes: number[] }
  | { type: "replace"; paneId: StagePaneId; ref: StagePaneRef }
  | { type: "reset" }
```

**Design note:** `StagePaneId` uses the "stage-pane-" prefix to avoid collision with the existing `SplitPaneId` ("pane-1" through "pane-6") which will continue to exist for terminal-internal splits until fully migrated.

**Design note:** Max 4 stage panes (vs. current max 6 terminal split panes). This is intentional — agent panes are heavier than terminal panes.

#### Pure functions (`stageLayout.pure.ts`)

```typescript
// Create a single-pane layout (default state)
buildSinglePaneLayout(ref: StagePaneRef): StageLayout

// Add a pane by splitting the focused pane
buildSplitLayout(current: StageLayout, newRef: StagePaneRef, orientation: "horizontal" | "vertical"): StageLayout

// Remove a pane, returns null if last pane removed
removePaneFromLayout(current: StageLayout, paneId: StagePaneId): StageLayout | null

// Focus a pane
focusPane(current: StageLayout, paneId: StagePaneId): StageLayout

// Resize panes
resizePanes(current: StageLayout, paneSizes: number[]): StageLayout

// Replace a pane's session reference (e.g., drag-drop tab into pane)
replacePaneRef(current: StageLayout, paneId: StagePaneId, ref: StagePaneRef): StageLayout

// Query helpers
getFocusedPane(layout: StageLayout): StagePane
getPaneBySessionId(layout: StageLayout, sessionId: string): StagePane | null
isSinglePane(layout: StageLayout): boolean
```

### Phase 3: `useStageLayout` Hook & `<StageView>` App Shell

**Goal:** Replace the binary routing in App.container with a unified stage that renders 1-4 panes of any session type.

#### 3a. `useStageLayout` Hook

**Location:** `src/app/model/useStageLayout.ts`

**Responsibilities:**
- Manages `StageLayout` state
- Derives layout from `activeSessionId` changes (when user clicks a tab, update the focused pane or create single-pane layout)
- Handles split/close/resize/focus actions
- Cleans up panes when sessions are closed

**State:**
```typescript
const [layout, setLayout] = useState<StageLayout | null>(null)
```

**Key behaviors:**
- When `activeSessionId` changes and no layout exists → create single-pane layout
- When `activeSessionId` changes and layout exists → focus the pane containing that session, or replace the focused pane
- When a session is closed → remove its pane from layout, if it was the last pane, set layout to null
- Split action → add new pane via `buildSplitLayout()`

**Backward compatibility:** A single-pane layout behaves identically to the current system. No UX change for users who don't split.

#### 3b. `<StageView>` App Shell

**Location:** `src/app/ui/stage-view/`

```
src/app/ui/stage-view/
  StageView.container.tsx
  StageSidebar.container.tsx
  TerminalStagePane.container.tsx
  AgentStagePane.container.tsx
  PendingStagePane.container.tsx
```

**`StageView.container.tsx` responsibilities:**
- Receives `StageLayout` + all session-related props from App
- For each pane in layout, resolves the session from `workspaceSessions` map
- Renders `<TerminalPane>` or `<AgentPane>` based on `pane.ref.kind`
- Renders draggable dividers between panes (reuses resize logic from existing split panes)
- Manages the **context-aware right sidebar** (see Phase 4)

**`StageView.presentational.tsx` renders:**
```
<div className="flex flex-col h-full">
  {/* Toolbar */}
  <div className="h-10 bg-sidebar border-b border-surface flex items-center px-2 gap-1">
    <ToolbarButton onClick={onToggleSidebar} />
    <WorkspaceSessionTabs ... />
    <SplitControls ... />
    <RightPanelToggle ... />
    <UsageLimitsButton ... />
  </div>

  {/* Stage content */}
  <div className="flex-1 flex {orientationClass} overflow-hidden">
    {panes.map((pane, i) => (
      <Fragment key={pane.id}>
        {i > 0 && <StageDivider orientation={...} onResize={...} />}
        <div style={{ flexGrow: paneSizes[i] }} className="min-w-0 min-h-0 overflow-hidden">
          {renderPane(pane)}
        </div>
      </Fragment>
    ))}
  </div>

  {/* Right sidebar (context-aware) */}
  {isRightSidebarOpen && <StageSidebar ... />}
</div>
```

### Phase 4: Context-Aware Right Sidebar

**Goal:** The right sidebar adapts its available tabs and behavior based on the **focused pane's session type**.

#### The Problem

The right sidebar currently has two separate implementations:
- Terminal (MainArea): 7 tabs with terminal-specific hooks
- Agent (AgentSessionView): 3 tabs with agent-specific hooks

In a split view, the sidebar must change when focus moves between panes.

#### Solution: `useStageSidebar` Hook

**Location:** `src/widgets/stage-view/model/useStageSidebar.ts`

**Approach:** The hook receives the focused pane's session reference and dynamically provides:
1. The list of available tabs
2. The active tab (persisted per session type, so switching focus restores the last-used tab)
3. The rendered panel content for the active tab

```typescript
function useStageSidebar(args: {
  focusedPane: StagePane
  focusedSession: WorkspaceSession
  // Terminal-specific dependencies
  activePaneSessionIdRef: React.RefObject<string | null>
  onSendPromptToSession: (sessionId: string, prompt: string) => Promise<void>
  // Agent-specific dependencies
  composerTextSetter: ((text: string) => void) | null
  // Shared dependencies
  projects: Project[]
  appSettings: AppSettings
}): {
  availableTabs: SidebarTab[]
  activeTab: SidebarTab
  setActiveTab: (tab: SidebarTab) => void
  panelContent: React.ReactNode
}
```

**Tab availability logic:**
```typescript
if (focusedSession is terminal) {
  availableTabs = ["settings", "files", "changes", "queue", "linear", "tmux", "review"]
} else if (focusedSession is agent) {
  availableTabs = ["changes", "linear", "queue"]
}
```

**Tab memory:** When switching focus between panes, the sidebar remembers the last selected tab per session type. For example:
- Focus terminal pane → sidebar shows "Files" tab (last used for terminal)
- Focus agent pane → sidebar switches to "Changes" tab (last used for agent)
- Focus back to terminal → sidebar returns to "Files"

**Hook integration pattern:** The shared panels (Queue, Linear) detect the focused session type and wire up the appropriate send handler:

```typescript
// Inside useStageSidebar
const sendHandler = isTerminalSession(focusedSession)
  ? (prompt: string) => onSendPromptToSession(activePaneSessionId, prompt)
  : (prompt: string) => composerTextSetter?.(prompt)
```

This means `PromptQueuePanel` and `LinearTaskQueuePanel` receive a unified `onSend` callback — they don't need to know whether they're in a terminal or agent context.

#### Sidebar Panels — Migration Plan

| Panel | Migration Strategy |
|-------|--------------------|
| **Queue** | Reuse `PromptQueuePanel` presentational. Create unified `useStagePromptQueue` hook that accepts a generic `onSend` callback (abstracts over terminal/agent difference). |
| **Linear** | Reuse `LinearTaskQueuePanel` presentational. Create unified `useStageLinearTaskQueue` hook with same generic `onSend` pattern. |
| **Changes** | For terminal context: reuse existing `ChangesPanel`. For agent context: reuse existing `ChangesTree` with polling. The sidebar renders the appropriate one based on focused session type. |
| **Settings** | Reuse `ProjectSettingsPanel` as-is. Only shown when focused pane is terminal. |
| **Files** | Reuse `FileExplorer` as-is. Only shown when focused pane is terminal. |
| **Tmux** | Reuse `TmuxPanel` as-is. Only shown when focused pane is terminal. |
| **Review** | Reuse `ReviewDraftPanel` as-is. Only shown when focused pane is terminal. |

---

## Phase 5: App.container Routing Update

**Goal:** Replace the binary routing with `<StageView>`.

### Before (current)

```typescript
// App.container.tsx render
if (activeAgentSession) {
  return <AgentSessionView sessionId={activeAgentSession.id} ... />
} else {
  return <MainArea activeSession={activeSession} ... />
}
```

### After

```typescript
// App.container.tsx render
return <StageView
  layout={stageLayout}
  workspaceSessions={workspaceSessions}
  onStageAction={handleStageAction}
  // ... all session props passed through
/>
```

The `sidebarMode === "work"` branch and `activeWorkspaceSettingsId` branch remain unchanged — they take priority over the stage view.

### Session Selection Flow Update

**Current:** Clicking a tab sets `activeSessionId` → App re-renders the entire view.

**New:** Clicking a tab either:
1. If the session is already in a pane → focus that pane
2. If the session is not in any pane → replace the focused pane's session reference
3. Double-click / "Open in split" → add a new pane with that session

This means `handleSelectWorkspaceSession` needs to be aware of the layout:

```typescript
function handleSelectWorkspaceSession(sessionId: string) {
  const existingPane = getPaneBySessionId(layout, sessionId)
  if (existingPane) {
    // Session already visible — just focus its pane
    dispatch({ type: "focus", paneId: existingPane.id })
  } else {
    // Replace focused pane content
    const ref = buildStagePaneRef(sessionId, workspaceSessions)
    dispatch({ type: "replace", paneId: layout.focusedPaneId, ref })
  }
  setActiveSessionId(sessionId)
}
```

---

## Phase 6: UX for Splitting — The Pane Picker

### Core Interaction: Cmd+D Opens a Pane Picker

Currently, `Cmd+D` immediately creates a new terminal split pane. In the new system, `Cmd+D` (and toolbar split buttons) opens a **Pane Picker** inside the newly created pane. The user must choose what to put in the pane before it becomes active.

#### Pane Picker Component

**Location:** `src/app/ui/stage-view/PendingStagePane.container.tsx`

**Trigger:** Any split action (Cmd+D, toolbar split buttons, right-click "Open in split")

**Behavior:**
1. A new pane is added to the layout in a "pending" state
2. The pane renders the pending-session picker instead of a terminal or agent session
3. The user can assign any existing session directly from the picker
4. Creating a new session from the sidebar while the pending pane is focused also fills that pane
5. If the user cancels, the pending pane is removed

#### Pane Picker UI

```
┌─────────────────────────────────────────┐
│  Open in pane                           │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ Search sessions...          🔍  │    │
│  └─────────────────────────────────┘    │
│                                         │
│  TERMINAL                               │
│  ┌─────────────────────────────────┐    │
│  │ + New terminal                  │    │
│  │   my-project (idle)             │    │
│  │   my-project#manual-1 (active)  │    │
│  │   workspace-alpha (idle)        │    │
│  └─────────────────────────────────┘    │
│                                         │
│  AGENT                                  │
│  ┌─────────────────────────────────┐    │
│  │ + New agent session             │    │
│  │   agent-1 • claude (running)    │    │
│  │   agent-2 • claude (idle)       │    │
│  └─────────────────────────────────┘    │
│                                         │
│  Press Escape to cancel                 │
└─────────────────────────────────────────┘
```

#### Pane Picker Sections

**Initial shipped behavior:**
- Existing terminal and agent sessions are listed directly in the pending pane
- New terminal / new agent creation stays in the sidebar flow for v1
- When a pending pane is focused, creating a new session from the sidebar fills that pane automatically

#### Search

The search input filters both sections simultaneously. Matches against session name, project name, and provider/model. Auto-focuses on mount so users can immediately type to filter.

#### Keyboard Navigation

- `Tab` / `Arrow Down/Up`: Navigate through the list
- `Enter`: Select the highlighted item
- `Escape`: Cancel and remove the pending pane
- Typing: Filters the list (search is focused by default)

#### StagePaneRef Update for Pending State

To support the picker, `StagePaneRef` gains a third variant:

```typescript
export type StagePaneRef =
  | { kind: "terminal"; sessionId: string }
  | { kind: "agent"; sessionId: string }
  | { kind: "pending" }                      // Pane picker is showing
```

The `<StageView>` render logic checks `pane.ref.kind`:
- `"terminal"` → render `<TerminalPane>`
- `"agent"` → render `<AgentPane>`
- `"pending"` → render `<PanePicker>`

When the user selects a session in the picker, the pane ref is replaced:
```typescript
dispatch({ type: "replace", paneId: pendingPane.id, ref: { kind: "terminal", sessionId } })
// or
dispatch({ type: "replace", paneId: pendingPane.id, ref: { kind: "agent", sessionId } })
```

When the user presses Escape:
```typescript
dispatch({ type: "close", paneId: pendingPane.id })
```

#### New File

| File | Purpose |
|------|---------|
| `src/widgets/stage-view/ui/PanePicker.container.tsx` | Pane picker container — loads session lists, handles creation |
| `src/widgets/stage-view/ui/PanePicker.presentational.tsx` | Pane picker UI — search, sections, keyboard nav |
| `src/widgets/stage-view/ui/PanePicker.types.ts` | Props types |

### Split Controls (Toolbar)

Extend the existing toolbar split buttons:
- **Split Vertical** / **Split Horizontal**: Adds a new pane in the chosen orientation with `kind: "pending"` — the Pane Picker appears in the new pane
- **Single**: Reset to single pane (close all other panes)

### Tab Interactions

- **Click**: Focus pane or replace focused pane (Phase 5 behavior)
- **Right-click context menu**: "Open in Split Right" / "Open in Split Below" — opens Pane Picker in new pane
- **Drag**: Drag a tab onto the left/right/top/bottom edge of the stage to split — directly assigns that session to the new pane (no picker needed since session is already chosen)

### Keyboard Shortcuts

- `Cmd+D`: Split focused pane (uses last split orientation) and open Pane Picker
- `Cmd+\` or `Cmd+Shift+E`: Split focused pane vertically and open Pane Picker
- `Cmd+Shift+\`: Split focused pane horizontally and open Pane Picker
- `Cmd+Option+Left/Right`: Focus previous/next pane
- `Cmd+W`: Close focused pane (if split), or close session (if single)

### Visual Focus Indicator

The focused pane gets a subtle accent border (similar to existing terminal split focus). Unfocused panes get a dimmed border.

---

## Phase 7: Terminal-Internal Splits (Migration)

The existing `SplitSessionState` handles terminal-to-terminal splits within a single session (multiple tmux panes for the same project). This is a **different concept** from the Stage layout:

- **Stage layout**: splits the central area into panes, each holding a different session
- **Terminal split**: splits a single terminal session into multiple tmux panes

These can **coexist**. A Stage pane holding a terminal session can itself be internally split into multiple tmux panes. The `SplitSessionState` continues to work inside `<TerminalPane>`.

Long-term, terminal-internal splits could also be migrated to use `StageLayout`, but this is NOT required for the initial implementation. The two systems are orthogonal.

---

## Migration & Backward Compatibility

### Phase 1-2: Zero UX change
- Extract pane components and create entity
- Existing `MainArea` and `AgentSessionView` continue to work unchanged
- New components are not yet wired into App routing

### Phase 3-4: Feature-flagged rollout
- `StageView` replaces the binary routing behind a feature flag (app setting)
- Default: `useStageLayout` creates a single-pane layout — identical to current behavior
- Users can opt into split via toolbar or keyboard shortcuts

### Phase 5-6: Full rollout
- Remove feature flag, `StageView` becomes the default
- Old `MainArea` and `AgentSessionView` widgets are deprecated but kept temporarily

### Phase 7: Cleanup
- Remove deprecated `MainArea` and `AgentSessionView` widgets
- Remove old `SplitSessionState` if terminal-internal splits are migrated
- Remove feature flag infrastructure

---

## Risk Areas & Mitigation

### 1. Performance — Multiple agent sessions rendering simultaneously
**Risk:** Agent sessions have heavy React trees (message timeline, activities, attachments). Two agent panes could cause jank.
**Mitigation:** Virtualize message lists (already partially done). Only poll/stream the focused agent session. Unfocused agent panes can pause real-time updates and show last-known state.

### 2. Right sidebar state conflicts
**Risk:** Switching focus between panes causes sidebar to jump between tab sets, losing user's scroll position or form state.
**Mitigation:** Per-session-type tab memory. Panel components should preserve internal state when hidden (use CSS visibility instead of unmounting, or use state persistence).

### 3. Prompt queue / Linear routing confusion
**Risk:** User sends a queued prompt but it goes to the wrong pane.
**Mitigation:** Always route to the **focused** pane. Show a visual indicator of which pane will receive the command. The sidebar header could show "Sending to: [pane name]".

### 4. Agent session `composerRef` coupling
**Risk:** `AgentPane` needs to expose its composer for text injection from the sidebar. Multiple agent panes mean multiple composers.
**Mitigation:** Track `composerRef` per pane in `StageView.container`. The sidebar always references the focused pane's composer.

### 5. Session lifecycle
**Risk:** Closing a session that's visible in a pane should remove the pane but not crash.
**Mitigation:** `useStageLayout` listens for session removals and auto-removes orphaned panes. If the last pane is removed, show an empty state or auto-select another session.

### 6. Terminal command registration per pane
**Risk:** Multiple terminal panes register commands. Need to route queue commands to the correct pane.
**Mitigation:** The existing `commandBySessionId` map already supports this — each terminal registers with its own sessionId. The prompt queue just needs to target the focused pane's sessionId.

---

## Files Affected (Estimated)

### New Files

| File | Purpose |
|------|---------|
| `src/entities/stage-layout/index.ts` | Public API |
| `src/entities/stage-layout/model/stageLayout.types.ts` | Types |
| `src/entities/stage-layout/lib/stageLayout.pure.ts` | Pure layout operations |
| `src/entities/stage-layout/lib/stagePaneId.pure.ts` | Pane ID constants |
| `src/app/ui/stage-view/StageView.container.tsx` | Main container |
| `src/app/ui/stage-view/StageSidebar.container.tsx` | Context-aware right sidebar |
| `src/app/ui/stage-view/TerminalStagePane.container.tsx` | Terminal pane wrapper |
| `src/app/ui/stage-view/AgentStagePane.container.tsx` | Agent pane wrapper |
| `src/app/ui/stage-view/PendingStagePane.container.tsx` | Pending pane picker |
| `src/app/model/useStageLayout.ts` | Layout state management |

### Modified Files

| File | Change |
|------|--------|
| `src/app/App.container.tsx` | Replace binary routing with `<StageView>`, integrate `useStageLayout` |
| `src/app/model/useSplitPaneManagement.ts` | Keep for terminal-internal splits, but decouple from stage layout |

### Eventually Deprecated (Phase 7)

| File | Reason |
|------|--------|
| `src/widgets/main-area/` | Replaced by `StageView` + `TerminalPane` |
| `src/widgets/agent-session-view/` | Replaced by `StageView` + `AgentPane` |
| `src/widgets/main-area/model/usePromptQueue.ts` | Replaced by `useStagePromptQueue` |
| `src/widgets/main-area/model/useLinearTaskQueue.ts` | Replaced by `useStageLinearTaskQueue` |
| `src/widgets/agent-session-view/model/useAgentPromptQueue.ts` | Replaced by `useStagePromptQueue` |
| `src/widgets/agent-session-view/model/useAgentLinearTaskQueue.ts` | Replaced by `useStageLinearTaskQueue` |

---

## Testing Strategy

### Unit Tests (pure functions)

- `stageLayout.pure.ts`: All layout operations (split, close, focus, resize, replace)
- `stagePaneId.pure.ts`: ID generation, validation
- Edge cases: max panes reached, close last pane, focus non-existent pane

### Integration Tests

- `useStageLayout`: Session selection updates layout correctly, session close removes pane
- `useStageSidebar`: Tab availability changes with focus, tab memory works across focus switches
- `useStagePromptQueue`: Routes to correct session type based on focused pane

### Manual Testing Checklist

- [ ] Single terminal session — behaves identically to current MainArea
- [ ] Single agent session — behaves identically to current AgentSessionView
- [ ] Split: terminal left + agent right — both render, focus switches correctly
- [ ] Split: agent left + agent right — both sessions stream independently
- [ ] Right sidebar adapts tabs when focus changes between terminal and agent panes
- [ ] Prompt queue sends to the focused pane (terminal: PTY, agent: composer)
- [ ] Linear issue sends to the focused pane
- [ ] Close a pane in split view — remaining pane expands
- [ ] Close a session via tab X — pane is removed from layout
- [ ] Resize panes via divider drag
- [ ] Terminal-internal splits still work inside a terminal stage pane
- [ ] Session persistence across app restart preserves layout
- [ ] Cmd+D opens Pane Picker in new pane (not an immediate terminal)
- [ ] Pane Picker shows existing terminal and agent sessions, searchable
- [ ] Pane Picker "New terminal" creates a terminal and fills the pane
- [ ] Pane Picker "New agent session" creates an agent and fills the pane
- [ ] Selecting an existing session from Pane Picker opens it in the pane
- [ ] Escape in Pane Picker removes the pending pane and reverts layout
- [ ] Dragging a tab into a split area skips the picker (session already known)

---

## Open Questions

1. **Should stage layout persist across app restart?** The current session persistence (`useSessionPersistence`) restores open sessions. Should it also restore the split layout? Recommendation: yes, serialize `StageLayout` alongside session state.

2. **Should tab clicks replace the focused pane or add a new pane?** Recommendation: single click replaces focused pane (matches current mental model). Right-click or modifier+click opens in new split.

3. **What happens when all sessions are closed?** Recommendation: show an empty state with "Open a project or agent session" prompt, matching current behavior.

4. **Should we support nested splits (e.g., vertical split, then horizontal split within one side)?** Recommendation: no, keep it flat for v1. A single orientation (all horizontal or all vertical) is much simpler. Nested splits can be a future enhancement.

5. **How to handle terminal-internal tmux splits + stage splits coexisting?** Recommendation: they're orthogonal. A terminal stage pane can internally have tmux splits. The stage manages the outer layout; tmux manages the inner terminal multiplexing.
