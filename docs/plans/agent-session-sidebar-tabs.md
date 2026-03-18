# Agent Session Sidebar Tabs — Linear, Queue, and Integrated Review

## Goal

Extend the agent session's right sidebar from a single `ChangesTree` panel into a **tabbed sidebar** with three tabs: **Changes** (default), **Linear**, and **Queue**. Additionally, integrate the review comment workflow directly into the Changes tab's diff drawer, rather than as a separate tab.

The "Send" action in Linear and Queue tabs must deliver content to the **agent chat composer** (not a terminal session).

## Context

### Current state

- **Agent session sidebar** (`AgentSessionView.presentational.tsx:175-182`) renders a fixed `ChangesTree` component in the `<aside>` — no tabs, no other panels.
- **Terminal session sidebar** (`MainArea.presentational.tsx:252-462`) has 7 tabs: Settings, Files, Changes, Queue, Linear, Tmux, Review — all wired through `MainArea.container.tsx`.
- The **Linear panel** is a fully presentational component (`LinearTaskQueuePanel.presentational.tsx`) that accepts `onSendItem` callback — it doesn't know where the prompt goes.
- The **Queue panel** is similarly presentational (`PromptQueuePanel.presentational.tsx`) with `onSendItem` callback.
- Both use hooks (`useLinearTaskQueue`, `usePromptQueue`) that currently depend on `activePaneSessionIdRef` and `onSendPromptToSession` — terminal-specific dispatch.
- The **Review tab** in the terminal sidebar is a standalone panel (`ReviewDraftPanel`) for collecting diff comments and running a review agent. In the agent session context, review should be integrated into the changes diff drawer instead.
- The agent composer (`AgentSessionComposer.container.tsx`) manages a draft with `text`, `interactionMode`, `attachments`. It persists drafts to `sessionStorage`.

### Why this matters

- **Linear**: The direct connection to project tasks is essential for the agent workflow. Users need to pick a task and feed it to the agent as context — this is the core loop of "pick task → send to agent → review changes."
- **Queue**: Pre-drafted prompts are useful for multi-step agent workflows where the user queues follow-up instructions.
- **Review in Changes**: In agent sessions, you're already looking at changes the agent made. Adding review comments directly from the diff (which the changes tab opens) is more natural than switching to a separate Review tab.

## Design decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Tabs for agent sidebar | Changes (default), Linear, Queue | Only tabs relevant to agent workflow. No Settings (terminal-specific), no Files (not needed now), no Tmux (terminal-only). |
| Default tab | Changes | Changes is the primary concern when reviewing agent work. Always start here. |
| Review as standalone tab | No — integrate into Changes diff drawer | In agent sessions, review comments belong in the diff context. The user is already clicking files from the Changes tree; the review flow should happen in the same drawer. This is a future enhancement — out of scope for this task. |
| Linear "Send" target | Populate agent chat composer input | User can review/edit the prompt before sending. More controllable than auto-submit. |
| Queue "Send" target | Populate agent chat composer input | Same rationale as Linear. Consistent behavior. |
| Tab bar styling | Match terminal sidebar tab bar | Reuse `TabButton` component pattern from `MainArea.presentational.tsx`. |
| Mobile sidebar | Existing `ModalShell` overlay with tabs | The current mobile overlay already wraps the Changes tree; extend it to include tabs. |
| Hook reuse | Create thin agent-specific wrappers | Reuse the core data-fetching logic from `useLinearTaskQueue` and `usePromptQueue`, but swap the dispatch mechanism. |

## Architecture

### FSD-lite layer placement

```
src/
├── features/
│   └── linear-task-queue/
│       └── ui/
│           └── LinearTaskQueuePanel.presentational.tsx   ← REUSED AS-IS (no changes)
│   └── prompt-queue/
│       └── ui/
│           └── PromptQueuePanel.presentational.tsx       ← REUSED AS-IS (no changes)
│   └── changes-tree/
│       └── ui/
│           └── ChangesTree.container.tsx                 ← REUSED AS-IS
│           └── ChangesTree.presentational.tsx            ← REUSED AS-IS
│
├── widgets/
│   └── agent-session-view/
│       └── ui/
│           └── AgentSessionView.presentational.tsx       ← MODIFIED: add tab bar, render tab content
│           └── AgentSessionView.container.tsx            ← MODIFIED: add Linear/Queue hook wiring
│           └── AgentSessionView.types.ts                ← MODIFIED: add tab + Linear/Queue props
│       └── model/
│           └── useAgentLinearTaskQueue.ts                ← NEW: agent-specific Linear hook
│           └── useAgentPromptQueue.ts                   ← NEW: agent-specific Queue hook
```

### Dependency flow

```
AgentSessionView.container
  ├── useAgentLinearTaskQueue (new)
  │     ├── fetching logic: extracted/shared from useLinearTaskQueue core
  │     └── dispatch: populates agent composer via onSetComposerText callback
  ├── useAgentPromptQueue (new)
  │     ├── fetching logic: reuses usePromptQueue as-is (or near-identical)
  │     └── dispatch: populates agent composer via onSetComposerText callback
  └── passes all props to AgentSessionView.presentational
        ├── Tab bar (Changes | Linear | Queue)
        ├── ChangesTree (existing, unchanged)
        ├── LinearTaskQueuePanel (presentational, reused)
        └── PromptQueuePanel (presentational, reused)
```

## Implementation plan

### Step 1: Add tab state and tab bar to agent sidebar

**Files to modify:**
- `src/widgets/agent-session-view/ui/AgentSessionView.types.ts`
- `src/widgets/agent-session-view/ui/AgentSessionView.container.tsx`
- `src/widgets/agent-session-view/ui/AgentSessionView.presentational.tsx`

**What to do:**

1. Define a new type in `AgentSessionView.types.ts`:
   ```typescript
   export type AgentSidebarTab = "changes" | "linear" | "queue";
   ```

2. Add `sidebarTab` state in `AgentSessionView.container.tsx`:
   ```typescript
   const [sidebarTab, setSidebarTab] = useState<AgentSidebarTab>("changes");
   ```
   Reset to `"changes"` when `props.sessionId` changes (in the existing `useEffect` at line 53-58).

3. In `AgentSessionView.presentational.tsx`, replace the direct `ChangesTree` render in the `<aside>` (line 175-182) with:
   - A tab bar with three `TabButton` components (Changes, Linear, Queue)
   - Conditional rendering based on `sidebarTab`
   - Changes tab renders the existing `ChangesTree`
   - Linear tab renders `LinearTaskQueuePanel`
   - Queue tab renders `PromptQueuePanel`

4. Do the same for the mobile `ModalShell` overlay (line 184-201) — add tabs there too.

**Tab bar pattern** (reference `MainArea.presentational.tsx:252-296`):
```tsx
<div className="flex items-center border-b border-surface">
  <TabButton active={sidebarTab === "changes"} onClick={() => onSidebarTabChange("changes")}>
    Changes
  </TabButton>
  <TabButton active={sidebarTab === "linear"} onClick={() => onSidebarTabChange("linear")}>
    Linear
  </TabButton>
  <TabButton active={sidebarTab === "queue"} onClick={() => onSidebarTabChange("queue")}>
    Queue
  </TabButton>
</div>
```

The `TabButton` component is used in `MainArea.presentational.tsx`. Check if it's imported from shared or defined locally — if local, extract to shared or duplicate the pattern.

### Step 2: Create `useAgentLinearTaskQueue` hook

**File to create:**
- `src/widgets/agent-session-view/model/useAgentLinearTaskQueue.ts`

**What to do:**

This hook adapts the Linear task queue for agent sessions. The key difference from `useLinearTaskQueue` (in `src/widgets/main-area/model/useLinearTaskQueue.ts`) is the dispatch mechanism.

**Interface:**
```typescript
interface UseAgentLinearTaskQueueParams {
  session: AgentSessionSnapshot | null;
  appSettings: { linearApiToken?: string | null };
  projects: Project[];
  workspaceMembersByWorkspaceId: Map<number, WorkspaceMember[]>;
  sidebarTab: AgentSidebarTab;
  onSetComposerText: (text: string) => void;
}
```

**Key differences from terminal version:**

1. **Session context**: Instead of `activeSession: TerminalSession`, use the agent session's project/workspace context. The agent session has `session.path` — use it to resolve the associated `Project` and its Linear mapping.

2. **Tab trigger**: The terminal version auto-loads when `rightPanelTab === "linear"`. This hook should auto-load when `sidebarTab === "linear"`.

3. **Send dispatch**: Instead of:
   ```typescript
   await onSendPromptToSession(currentSessionId, buildLinearIssuePrompt(issue));
   ```
   Do:
   ```typescript
   onSetComposerText(buildLinearIssuePrompt(issue));
   ```
   This populates the agent composer textarea. The user can then review/edit and press Send.

4. **Context derivation**: The terminal version uses `activeSession.type`, `activeSession.projectId`, `activeSession.targetId` to build `linearSessionContext`. For agent sessions, you need to derive context from the agent session's `path` by finding the matching project in `projects`. The agent session doesn't have `projectId`/`targetId` directly — look at how `AgentSessionView` receives its data to find the right project reference. This may require passing additional props from `App.container.tsx`.

**Approach options:**

- **Option A (simpler)**: Fork `useLinearTaskQueue`, replace the dispatch and session context parts. Some code duplication but faster to ship.
- **Option B (cleaner)**: Extract the core fetching logic from `useLinearTaskQueue` into a shared `useLinearTaskQueueCore` hook, then create thin wrappers for terminal and agent. More refactoring but DRYer.

**Recommendation**: Start with Option A. The hook is ~430 lines but most of the fetching logic is straightforward. The terminal version has terminal-specific concerns (split panes, `activePaneSessionIdRef`) that don't apply. A clean fork is easier to reason about.

### Step 3: Create `useAgentPromptQueue` hook

**File to create:**
- `src/widgets/agent-session-view/model/useAgentPromptQueue.ts`

**What to do:**

Adapt `usePromptQueue` for agent sessions. This is simpler than Linear because the prompt queue hook is already small (~168 lines).

**Interface:**
```typescript
interface UseAgentPromptQueueParams {
  queueScope: { scopeType: PromptQueueScopeType; scopeId: number } | null;
  onSetComposerText: (text: string) => void;
}
```

**Key differences from terminal version:**

1. **Send dispatch**: Instead of `onSendPromptToSession(currentSessionId, item.prompt)`, call `onSetComposerText(item.prompt)`.

2. **No `activePaneSessionIdRef`**: Agent sessions don't have split panes. Remove the ref dependency entirely.

3. **Queue scope**: Needs to be derived from the agent session's project context. Same approach as Linear — find the matching project for the session's path, then build a `{ scopeType: "project", scopeId: project.id }` or equivalent.

4. **Delete after send**: The terminal version deletes the queue item after sending (`deletePromptQueueItem(itemId)`). For agent sessions, the same behavior makes sense — the item was sent (populated in composer), so remove it from the queue.

### Step 4: Wire the composer text injection

**Files to modify:**
- `src/widgets/agent-session-view/ui/AgentSessionComposer.container.tsx`
- `src/widgets/agent-session-view/ui/AgentSessionView.container.tsx`

**What to do:**

The composer currently manages its own `draft` state internally via `useState`. To allow external code (Linear/Queue send) to populate the text, we need an injection mechanism.

**Approach options:**

- **Option A — Callback prop**: Add an `externalTextRef` or `onExternalText` callback that the composer exposes. The container can call `setComposerText(text)` which updates the draft.
- **Option B — Lift draft text**: Lift the `draft.text` state up to `AgentSessionView.container.tsx` so both the composer and the sidebar hooks can read/write it. However, this is intrusive — the composer has complex draft persistence logic.
- **Option C — Imperative ref**: Expose a `composerRef` with a `setText(text: string)` method. The container passes this ref to both the composer and the hooks.

**Recommendation**: Option C (imperative ref) is cleanest. The composer already manages its own state and persistence — we don't want to lift all of that. An imperative `setText` call is a one-shot injection that doesn't interfere with the existing draft lifecycle.

```typescript
// In AgentSessionComposer.container.tsx
useImperativeHandle(composerRef, () => ({
  setText(text: string) {
    setDraft((prev) => ({ ...prev, text }));
  },
}), []);
```

```typescript
// In AgentSessionView.container.tsx
const composerRef = useRef<{ setText: (text: string) => void }>(null);

const handleSetComposerText = useCallback((text: string) => {
  composerRef.current?.setText(text);
}, []);
```

Pass `composerRef` to `AgentSessionComposerContainer` via `React.forwardRef`, and pass `handleSetComposerText` to the Linear and Queue hooks as `onSetComposerText`.

### Step 5: Pass required data from App.container.tsx

**Files to modify:**
- `src/app/App.container.tsx` (or wherever `AgentSessionView` is rendered)
- `src/widgets/agent-session-view/ui/AgentSessionView.types.ts`

**What to do:**

The Linear and Queue hooks need data that currently only flows through the terminal's `MainArea`:
- `projects: Project[]` — list of all projects (for resolving Linear project mapping)
- `appSettings.linearApiToken` — the Linear API token
- `workspaceMembersByWorkspaceId` — for workspace-scoped Linear fetching

Check what's already available in the scope where `AgentSessionView` is rendered. Add any missing props to `AgentSessionViewProps`.

### Step 6: Update the mobile sidebar toggle button

**Files to modify:**
- `src/widgets/agent-session-view/ui/AgentSessionView.presentational.tsx`

**What to do:**

The current toggle button (line 62-76) has a hardcoded title "Hide changes"/"Show changes" and a single icon. Update it to say "Hide sidebar"/"Show sidebar" since the sidebar now contains more than just changes.

Optionally, change the icon to a generic sidebar icon (e.g., a panel icon) rather than the current custom SVG.

## Key file references

| File | Path | Role |
|------|------|------|
| Agent session presentational | `src/widgets/agent-session-view/ui/AgentSessionView.presentational.tsx` | Right sidebar lives at lines 175-201 |
| Agent session container | `src/widgets/agent-session-view/ui/AgentSessionView.container.tsx` | Hook wiring, state management |
| Agent session types | `src/widgets/agent-session-view/ui/AgentSessionView.types.ts` | Props interfaces |
| Agent composer | `src/widgets/agent-session-view/ui/AgentSessionComposer.container.tsx` | Draft state, submit logic |
| Terminal Linear hook | `src/widgets/main-area/model/useLinearTaskQueue.ts` | Reference implementation (430 lines) |
| Terminal Queue hook | `src/widgets/main-area/model/usePromptQueue.ts` | Reference implementation (168 lines) |
| Linear panel (presentational) | `src/features/linear-task-queue/ui/LinearTaskQueuePanel.presentational.tsx` | Reuse directly — props-only component |
| Linear pure utilities | `src/features/linear-task-queue/lib/linearTaskQueue.pure.ts` | `buildLinearIssuePrompt`, `filterLinearTaskQueueIssues`, etc. |
| Queue panel (presentational) | `src/features/prompt-queue/ui/PromptQueuePanel.presentational.tsx` | Reuse directly — props-only component |
| Queue entity/DB | `src/entities/prompt-queue/` | DB CRUD for prompt queue |
| Changes tree | `src/features/changes-tree/ui/ChangesTree.container.tsx` | Already used in agent sidebar |
| Terminal tab bar | `src/widgets/main-area/ui/MainArea.presentational.tsx:252-296` | Reference for TabButton pattern |
| Terminal right panel types | `src/widgets/main-area/ui/MainArea.types.ts:70` | `RightPanelTab` type definition |
| Shared Linear API | `src/shared/api/` (search for `fetchLinearProjectIssues`, `getProjectLinearRef`) | API calls reused by both hooks |
| Diff review feature | `src/features/diff-review/` | Future: integrate into agent Changes diff drawer |

## Presentational component description changes

The `LinearTaskQueuePanel` subtitle currently says:
```
"Fetch project issues and send one as a prompt to this terminal."
```
This should be made configurable or updated to be context-neutral:
```
"Fetch project issues and send one as a prompt."
```

Similarly, the `PromptQueuePanel` subtitle says:
```
"Queue prompts and send them to this active terminal."
```
Update to:
```
"Queue prompts and send them to the active session."
```

These are minor text changes in the presentational components. Consider adding an optional `description` prop to override the default text, or just make the text generic enough for both contexts.

## Out of scope (future work)

1. **Review integration into Changes diff drawer** — The review comment workflow should eventually be accessible from the agent session's change drawer (click a file in Changes → open diff → add review comments → submit to agent). This requires extending `AgentSessionChangeDrawer.container.tsx` with the diff comment anchoring from `useDiffReviewDraft`. Track as a separate task.

2. **Shared sidebar abstraction** — Eventually extract a shared `RightSidebar` widget that both terminal and agent views compose. For now, the incremental approach is faster and lower risk.

3. **Terminal sidebar cleanup** — The terminal sidebar has tabs that could be reorganized (Settings is a grab-bag, Tmux is niche). Separate initiative.

## Testing considerations

- `LinearTaskQueuePanel` and `PromptQueuePanel` are presentational — existing tests (if any) continue to work.
- New hooks (`useAgentLinearTaskQueue`, `useAgentPromptQueue`) should have unit tests for:
  - Correct dispatch to `onSetComposerText` instead of `onSendPromptToSession`
  - Context derivation from agent session path
  - Auto-load trigger when tab becomes active
- Integration: manually verify that clicking "Send" on a Linear issue populates the agent composer textarea with the formatted prompt.
- Verify mobile overlay (ModalShell) renders all three tabs correctly.
- Verify tab state resets to "changes" when switching agent sessions.
