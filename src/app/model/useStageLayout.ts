import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  buildSinglePaneLayout,
  buildSplitLayout,
  focusPane,
  getFocusedPane,
  getPaneBySessionId,
  isAgentSession,
  removePaneFromLayout,
  replacePaneRef,
  resizeAdjacentPanes,
  resizePanes,
  type StageLayout,
  type StageLayoutOrientation,
  type StagePane,
  type StagePaneId,
  type StagePaneRef,
  type WorkspaceSession,
} from "../../entities";
import { createDebouncedTask } from "../../shared";
import {
  clearPersistedStageLayoutState,
  loadPersistedStageLayoutState,
  savePersistedStageLayoutState,
} from "../api/stageLayoutPersistence.api";

const STAGE_LAYOUT_PERSISTENCE_DEBOUNCE_MS = 250;

interface UseStageLayoutParams {
  workspaceSessions: Map<string, WorkspaceSession>;
  activeSessionId: string | null;
  setActiveSessionId: Dispatch<SetStateAction<string | null>>;
  restoreTabsOnRestart: boolean;
}

interface UseStageLayoutResult {
  layout: StageLayout | null;
  setLayout: Dispatch<SetStateAction<StageLayout | null>>;
  focusedPane: StagePane | null;
  handleSelectSession: (sessionId: string) => boolean;
  handleFocusPane: (paneId: StagePaneId) => void;
  handleSplitPane: (orientation: StageLayoutOrientation, ref?: StagePaneRef) => void;
  handleReplacePaneRef: (paneId: StagePaneId, ref: StagePaneRef) => void;
  handleResizePanes: (paneSizes: number[]) => void;
  handleResizeAdjacentPanes: (dividerIndex: number, deltaRatio: number) => void;
  handleClosePane: (paneId: StagePaneId) => void;
  handleCloseFocusedPane: () => void;
  handleResetToSinglePane: (sessionId?: string | null) => void;
  focusNextPane: () => void;
  focusPreviousPane: () => void;
}

function buildStagePaneRef(session: WorkspaceSession | null | undefined): StagePaneRef | null {
  if (!session) {
    return null;
  }

  return isAgentSession(session)
    ? { kind: "agent", sessionId: session.id }
    : { kind: "terminal", sessionId: session.id };
}

export function useStageLayout({
  workspaceSessions,
  activeSessionId,
  setActiveSessionId,
  restoreTabsOnRestart,
}: UseStageLayoutParams): UseStageLayoutResult {
  const [layout, setLayout] = useState<StageLayout | null>(null);
  const hasRestoredLayoutRef = useRef(false);
  const pendingPersistRef = useRef({
    layout,
    restoreTabsOnRestart,
  });
  const persistTaskRef = useRef(createDebouncedTask(() => {
    const pending = pendingPersistRef.current;
    if (!pending.restoreTabsOnRestart) {
      clearPersistedStageLayoutState();
      return;
    }

    savePersistedStageLayoutState(pending.layout);
  }, STAGE_LAYOUT_PERSISTENCE_DEBOUNCE_MS));

  pendingPersistRef.current = {
    layout,
    restoreTabsOnRestart,
  };

  useEffect(() => {
    const persistTask = persistTaskRef.current;
    return () => {
      persistTask.flush();
      persistTask.cancel();
    };
  }, []);

  useEffect(() => {
    if (hasRestoredLayoutRef.current) {
      return;
    }
    hasRestoredLayoutRef.current = true;

    if (!restoreTabsOnRestart) {
      clearPersistedStageLayoutState();
      return;
    }

    const restoredLayout = loadPersistedStageLayoutState();
    if (restoredLayout) {
      setLayout(restoredLayout);
    }
  }, [restoreTabsOnRestart]);

  useEffect(() => {
    if (!hasRestoredLayoutRef.current) {
      return;
    }

    if (!restoreTabsOnRestart) {
      persistTaskRef.current.cancel();
      clearPersistedStageLayoutState();
      return;
    }

    persistTaskRef.current.schedule();
  }, [layout, restoreTabsOnRestart]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      persistTaskRef.current.flush();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  useEffect(() => {
    setLayout((previous: StageLayout | null) => {
      if (!previous) {
        return previous;
      }

      let nextLayout: StageLayout | null = previous;
      let changed = false;

      for (const pane of previous.panes) {
        if (pane.ref.kind === "pending" || workspaceSessions.has(pane.ref.sessionId)) {
          continue;
        }

        if (!nextLayout) {
          break;
        }

        nextLayout = removePaneFromLayout(nextLayout, pane.id);
        changed = true;
        if (!nextLayout) {
          break;
        }
      }

      return changed ? nextLayout : previous;
    });
  }, [workspaceSessions]);

  useEffect(() => {
    if (!activeSessionId) {
      return;
    }

    const activeSession = workspaceSessions.get(activeSessionId);
    const nextRef = buildStagePaneRef(activeSession);
    if (!nextRef) {
      return;
    }

    setLayout((previous: StageLayout | null) => {
      if (!previous) {
        return buildSinglePaneLayout(nextRef);
      }

      const existingPane = getPaneBySessionId(previous, activeSessionId);
      if (existingPane) {
        return focusPane(previous, existingPane.id);
      }

      return replacePaneRef(previous, previous.focusedPaneId, nextRef);
    });
  }, [activeSessionId, workspaceSessions]);

  const focusedPane = useMemo(() => {
    if (!layout || layout.panes.length === 0) {
      return null;
    }

    return getFocusedPane(layout);
  }, [layout]);

  const handleSelectSession = useCallback((sessionId: string): boolean => {
    const nextRef = buildStagePaneRef(workspaceSessions.get(sessionId));
    if (!nextRef) {
      return false;
    }

    setLayout((previous: StageLayout | null) => {
      if (!previous) {
        return buildSinglePaneLayout(nextRef);
      }

      const existingPane = getPaneBySessionId(previous, sessionId);
      if (existingPane) {
        return focusPane(previous, existingPane.id);
      }

      return replacePaneRef(previous, previous.focusedPaneId, nextRef);
    });
    setActiveSessionId(sessionId);
    return true;
  }, [setActiveSessionId, workspaceSessions]);

  const handleFocusPane = useCallback((paneId: StagePaneId) => {
    let nextActiveId: string | null = null;
    setLayout((previous: StageLayout | null) => {
      if (!previous) {
        return previous;
      }

      const pane = previous.panes.find((item: StagePane) => item.id === paneId);
      if (!pane) {
        return previous;
      }

      if (pane.ref.kind !== "pending") {
        nextActiveId = pane.ref.sessionId;
      }
      return focusPane(previous, paneId);
    });

    if (nextActiveId) {
      setActiveSessionId(nextActiveId);
    }
  }, [setActiveSessionId]);

  const handleSplitPane = useCallback((orientation: StageLayoutOrientation, ref: StagePaneRef = { kind: "pending" }) => {
    setLayout((previous: StageLayout | null) => {
      if (previous) {
        return buildSplitLayout(previous, ref, orientation);
      }

      const activeRef = buildStagePaneRef(activeSessionId ? workspaceSessions.get(activeSessionId) : null);
      if (!activeRef) {
        return previous;
      }

      return buildSplitLayout(buildSinglePaneLayout(activeRef), ref, orientation);
    });

    if (ref.kind !== "pending") {
      setActiveSessionId(ref.sessionId);
    }
  }, [activeSessionId, setActiveSessionId, workspaceSessions]);

  const handleReplacePaneRef = useCallback((paneId: StagePaneId, ref: StagePaneRef) => {
    setLayout((previous: StageLayout | null) => {
      if (!previous) {
        return previous;
      }

      return replacePaneRef(previous, paneId, ref);
    });

    if (ref.kind !== "pending") {
      setActiveSessionId(ref.sessionId);
    }
  }, [setActiveSessionId]);

  const handleResizeLayoutPanes = useCallback((paneSizes: number[]) => {
    setLayout((previous: StageLayout | null) => (previous ? resizePanes(previous, paneSizes) : previous));
  }, []);

  const handleResizeAdjacentLayoutPanes = useCallback((dividerIndex: number, deltaRatio: number) => {
    setLayout((previous: StageLayout | null) => (
      previous ? resizeAdjacentPanes(previous, dividerIndex, deltaRatio) : previous
    ));
  }, []);

  const handleClosePane = useCallback((paneId: StagePaneId) => {
    let nextActiveId: string | null = null;
    setLayout((previous: StageLayout | null) => {
      if (!previous) {
        return previous;
      }

      const nextLayout = removePaneFromLayout(previous, paneId);
      if (!nextLayout) {
        return null;
      }

      const nextFocusedPane = getFocusedPane(nextLayout);
      if (nextFocusedPane.ref.kind !== "pending") {
        nextActiveId = nextFocusedPane.ref.sessionId;
      }
      return nextLayout;
    });

    setActiveSessionId(nextActiveId);
  }, [setActiveSessionId]);

  const handleCloseFocusedPane = useCallback(() => {
    if (!focusedPane) {
      return;
    }
    handleClosePane(focusedPane.id);
  }, [focusedPane, handleClosePane]);

  const handleResetToSinglePane = useCallback((sessionId?: string | null) => {
    const nextSessionId = sessionId ?? activeSessionId;
    const nextRef = buildStagePaneRef(nextSessionId ? workspaceSessions.get(nextSessionId) : null);
    if (!nextRef) {
      setLayout(null);
      setActiveSessionId(null);
      return;
    }

    setLayout(buildSinglePaneLayout(nextRef));
    setActiveSessionId(nextSessionId);
  }, [activeSessionId, setActiveSessionId, workspaceSessions]);

  const focusAdjacentPane = useCallback((direction: "next" | "previous") => {
    let nextActiveId: string | null = null;
    setLayout((previous: StageLayout | null) => {
      if (!previous || previous.panes.length <= 1) {
        return previous;
      }

      const currentIndex = previous.panes.findIndex((pane: StagePane) => pane.id === previous.focusedPaneId);
      if (currentIndex < 0) {
        return previous;
      }

      const nextIndex = direction === "next"
        ? (currentIndex + 1) % previous.panes.length
        : (currentIndex - 1 + previous.panes.length) % previous.panes.length;
      const nextPane = previous.panes[nextIndex];
      if (!nextPane) {
        return previous;
      }

      if (nextPane.ref.kind !== "pending") {
        nextActiveId = nextPane.ref.sessionId;
      }
      return focusPane(previous, nextPane.id);
    });

    if (nextActiveId) {
      setActiveSessionId(nextActiveId);
    }
  }, [setActiveSessionId]);

  return {
    layout,
    setLayout,
    focusedPane,
    handleSelectSession,
    handleFocusPane,
    handleSplitPane,
    handleReplacePaneRef,
    handleResizePanes: handleResizeLayoutPanes,
    handleResizeAdjacentPanes: handleResizeAdjacentLayoutPanes,
    handleClosePane,
    handleCloseFocusedPane,
    handleResetToSinglePane,
    focusNextPane: () => focusAdjacentPane("next"),
    focusPreviousPane: () => focusAdjacentPane("previous"),
  };
}
