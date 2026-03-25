import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangesMode, GitChangeEntry } from "../../entities";
import type { EditorSession, WorkspaceSession } from "../../entities";
import {
  buildEditorSession,
  findEditorSessionByFilePath,
} from "../../entities";
import { formatFileSize } from "../../shared";
import { getBranchDiff, getWorkingDiff } from "../../shared/api/git.api";
import {
  DEFAULT_TEXT_FILE_READ_TIMEOUT_MS,
  readTextFileWithTimeout,
  writeTextFile,
} from "../../shared/api/fs.api";

const EDITOR_SESSION_LOAD_TIMEOUT_MS = DEFAULT_TEXT_FILE_READ_TIMEOUT_MS;

export interface EditorSessionViewState {
  preferredTab: "edit" | "diff";
  diffMode: ChangesMode | null;
  changeEntry: GitChangeEntry | null;
  focusLine: number | null;
  focusColumn: number | null;
  requestKey: number;
}

export interface EditorSessionRuntimeState {
  content: string;
  initialContent: string;
  fileLoadError: string | null;
  fileSaveError: string | null;
  isLoadingFile: boolean;
  isSavingFile: boolean;
  isReadOnly: boolean;
  isDeleted: boolean;
  largeFileWarning: string | null;
  diff: {
    text: string;
    isBinary: boolean;
  } | null;
  diffMode: ChangesMode | null;
  diffLoading: boolean;
  diffError: string | null;
  activeTab: "edit" | "diff" | "view";
  isLoaded: boolean;
}

export interface OpenOrReuseEditorSessionInput {
  targetType: EditorSession["targetType"];
  targetId: number;
  projectId: number;
  workspaceOwnerId?: number;
  workspaceKey: string;
  path: string;
  filePath: string;
  preferredTab?: "edit" | "diff";
  diffMode?: ChangesMode | null;
  changeEntry?: GitChangeEntry | null;
  focusLine?: number | null;
  focusColumn?: number | null;
}

interface UseEditorSessionManagementResult {
  editorSessions: Map<string, EditorSession>;
  setEditorSessions: React.Dispatch<React.SetStateAction<Map<string, EditorSession>>>;
  editorViewStateBySessionId: Map<string, EditorSessionViewState>;
  editorRuntimeStateBySessionId: Map<string, EditorSessionRuntimeState>;
  openOrReuseEditorSession: (input: OpenOrReuseEditorSessionInput) => {
    session: EditorSession;
    isExisting: boolean;
  };
  ensureEditorSessionLoaded: (sessionId: string, options?: { force?: boolean }) => Promise<void>;
  applyEditorSessionViewState: (sessionId: string, viewState: EditorSessionViewState) => Promise<void>;
  setEditorSessionActiveTab: (sessionId: string, activeTab: EditorSessionRuntimeState["activeTab"]) => void;
  changeEditorSessionContent: (sessionId: string, next: string) => void;
  saveEditorSession: (sessionId: string) => Promise<void>;
  closeEditorSession: (sessionId: string, options?: { skipConfirm?: boolean }) => boolean;
  updateEditorSessionStatus: (sessionId: string, status: EditorSession["status"]) => void;
  closeSessionsForProject: (projectId: number) => void;
  closeSessionsForDivergence: (divergenceId: number) => void;
  closeSessionsForWorkspace: (workspaceId: number) => void;
  closeSessionsForWorkspaceDivergence: (workspaceDivergenceId: number) => void;
  closeSessionForFilePath: (filePath: string, options?: { skipConfirm?: boolean }) => boolean;
}

function buildDefaultRuntimeState(activeTab: EditorSessionRuntimeState["activeTab"] = "edit"): EditorSessionRuntimeState {
  return {
    content: "",
    initialContent: "",
    fileLoadError: null,
    fileSaveError: null,
    isLoadingFile: false,
    isSavingFile: false,
    isReadOnly: false,
    isDeleted: false,
    largeFileWarning: null,
    diff: null,
    diffMode: null,
    diffLoading: false,
    diffError: null,
    activeTab,
    isLoaded: false,
  };
}

function buildViewState(
  previous: EditorSessionViewState | undefined,
  input: Pick<
    OpenOrReuseEditorSessionInput,
    "preferredTab" | "diffMode" | "changeEntry" | "focusLine" | "focusColumn"
  >,
): EditorSessionViewState {
  return {
    preferredTab: input.preferredTab ?? (input.changeEntry ? "diff" : "edit"),
    diffMode: input.diffMode ?? null,
    changeEntry: input.changeEntry ?? null,
    focusLine: input.focusLine ?? null,
    focusColumn: input.focusColumn ?? null,
    requestKey: (previous?.requestKey ?? 0) + 1,
  };
}

function isRuntimeDirty(state: EditorSessionRuntimeState | undefined): boolean {
  if (!state) {
    return false;
  }

  return state.content !== state.initialContent;
}

export function useEditorSessionManagement(): UseEditorSessionManagementResult {
  const [editorSessions, setEditorSessions] = useState<Map<string, EditorSession>>(new Map());
  const [editorViewStateBySessionId, setEditorViewStateBySessionId] = useState<Map<string, EditorSessionViewState>>(new Map());
  const [editorRuntimeStateBySessionId, setEditorRuntimeStateBySessionId] = useState<Map<string, EditorSessionRuntimeState>>(new Map());
  const editorSessionsRef = useRef(editorSessions);
  const editorRuntimeStateBySessionIdRef = useRef(editorRuntimeStateBySessionId);
  const editorLoadRequestIdBySessionIdRef = useRef(new Map<string, number>());

  useEffect(() => {
    editorSessionsRef.current = editorSessions;
  }, [editorSessions]);

  useEffect(() => {
    editorRuntimeStateBySessionIdRef.current = editorRuntimeStateBySessionId;
  }, [editorRuntimeStateBySessionId]);

  useEffect(() => {
    const sessionIds = new Set(editorSessions.keys());

    editorLoadRequestIdBySessionIdRef.current.forEach((_, key) => {
      if (!sessionIds.has(key)) {
        editorLoadRequestIdBySessionIdRef.current.delete(key);
      }
    });

    setEditorViewStateBySessionId((previous) => {
      let changed = false;
      const next = new Map<string, EditorSessionViewState>();
      previous.forEach((value, key) => {
        if (sessionIds.has(key)) {
          next.set(key, value);
          return;
        }
        changed = true;
      });
      return changed ? next : previous;
    });

    setEditorRuntimeStateBySessionId((previous) => {
      let changed = false;
      const next = new Map<string, EditorSessionRuntimeState>();
      previous.forEach((value, key) => {
        if (sessionIds.has(key)) {
          next.set(key, value);
          return;
        }
        changed = true;
      });
      return changed ? next : previous;
    });
  }, [editorSessions]);

  const updateEditorViewState = useCallback((
    sessionId: string,
    input: Pick<
      OpenOrReuseEditorSessionInput,
      "preferredTab" | "diffMode" | "changeEntry" | "focusLine" | "focusColumn"
    >,
  ) => {
    setEditorViewStateBySessionId((previous) => {
      const next = new Map(previous);
      next.set(sessionId, buildViewState(previous.get(sessionId), input));
      return next;
    });
  }, []);

  const updateEditorRuntimeState = useCallback((
    sessionId: string,
    updater: (current: EditorSessionRuntimeState) => EditorSessionRuntimeState,
  ) => {
    setEditorRuntimeStateBySessionId((previous) => {
      const current = previous.get(sessionId) ?? buildDefaultRuntimeState();
      const nextState = updater(current);
      if (nextState === current) {
        return previous;
      }
      const next = new Map(previous);
      next.set(sessionId, nextState);
      return next;
    });
  }, []);

  const updateEditorSessionStatus = useCallback((sessionId: string, status: EditorSession["status"]) => {
    setEditorSessions((previous) => {
      const session = previous.get(sessionId);
      if (!session || session.status === status) {
        return previous;
      }

      const next = new Map(previous);
      next.set(sessionId, { ...session, status });
      return next;
    });
  }, []);

  const fetchEditorSessionDiff = useCallback(async (sessionId: string, mode: ChangesMode) => {
    const session = editorSessionsRef.current.get(sessionId);
    if (!session) {
      return;
    }

    updateEditorRuntimeState(sessionId, (current) => ({
      ...current,
      diff: null,
      diffMode: mode,
      diffLoading: true,
      diffError: null,
    }));

    try {
      const diff = mode === "branch"
        ? await getBranchDiff(session.path, session.filePath)
        : await getWorkingDiff(session.path, session.filePath);
      updateEditorRuntimeState(sessionId, (current) => ({
        ...current,
        diff: {
          text: diff.diff,
          isBinary: diff.isBinary,
        },
        diffMode: mode,
        diffLoading: false,
        diffError: null,
      }));
    } catch (error) {
      updateEditorRuntimeState(sessionId, (current) => ({
        ...current,
        diff: null,
        diffMode: mode,
        diffLoading: false,
        diffError: error instanceof Error ? error.message : "Failed to load diff.",
      }));
    }
  }, [updateEditorRuntimeState]);

  const ensureEditorSessionLoaded = useCallback(async (sessionId: string, options?: { force?: boolean }) => {
    const session = editorSessionsRef.current.get(sessionId);
    if (!session) {
      return;
    }

    const current = editorRuntimeStateBySessionIdRef.current.get(sessionId);
    if (!options?.force && (current?.isLoaded || current?.isLoadingFile)) {
      return;
    }

    const requestId = (editorLoadRequestIdBySessionIdRef.current.get(sessionId) ?? 0) + 1;
    editorLoadRequestIdBySessionIdRef.current.set(sessionId, requestId);

    const isStaleLoadRequest = () => (
      editorLoadRequestIdBySessionIdRef.current.get(sessionId) !== requestId
      || !editorSessionsRef.current.has(sessionId)
    );

    updateEditorRuntimeState(sessionId, (previous) => ({
      ...previous,
      isLoadingFile: true,
      fileLoadError: null,
      fileSaveError: null,
      isDeleted: false,
      largeFileWarning: null,
      diff: previous.diff,
      diffMode: previous.diffMode,
      diffLoading: previous.diffLoading,
      diffError: previous.diffError,
    }));

    try {
      const content = await readTextFileWithTimeout(
        session.filePath,
        EDITOR_SESSION_LOAD_TIMEOUT_MS,
      );
      if (isStaleLoadRequest()) {
        return;
      }
      updateEditorRuntimeState(sessionId, (previous) => ({
        ...previous,
        content,
        initialContent: content,
        fileLoadError: null,
        fileSaveError: null,
        isLoadingFile: false,
        isReadOnly: content.includes("\0"),
        isDeleted: false,
        largeFileWarning: content.length > 2_000_000
          ? `Large file (${formatFileSize(content.length)}). Editing may be slow.`
          : null,
        isLoaded: true,
      }));
      updateEditorSessionStatus(sessionId, "idle");
    } catch (error) {
      if (isStaleLoadRequest()) {
        return;
      }
      updateEditorRuntimeState(sessionId, (previous) => ({
        ...previous,
        content: previous.isLoaded ? previous.content : "",
        initialContent: previous.isLoaded ? previous.initialContent : "",
        fileLoadError: error instanceof Error ? error.message : "Failed to read file.",
        fileSaveError: null,
        isLoadingFile: false,
        isReadOnly: previous.isLoaded ? previous.isReadOnly : false,
        isDeleted: false,
        largeFileWarning: previous.isLoaded ? previous.largeFileWarning : null,
        isLoaded: previous.isLoaded,
      }));
      updateEditorSessionStatus(sessionId, "idle");
    }
  }, [updateEditorRuntimeState, updateEditorSessionStatus]);

  const setEditorSessionActiveTab = useCallback((
    sessionId: string,
    activeTab: EditorSessionRuntimeState["activeTab"],
  ) => {
    updateEditorRuntimeState(sessionId, (current) => (
      current.activeTab === activeTab
        ? current
        : { ...current, activeTab }
    ));
  }, [updateEditorRuntimeState]);

  const applyEditorSessionViewState = useCallback(async (sessionId: string, viewState: EditorSessionViewState) => {
    const session = editorSessionsRef.current.get(sessionId);
    if (!session) {
      return;
    }

    const diffMode = viewState.diffMode ?? "working";
    const isDeletedChange = viewState.changeEntry?.status === "D";

    if (isDeletedChange) {
      updateEditorRuntimeState(sessionId, (current) => ({
        ...current,
        content: "",
        initialContent: "",
        fileLoadError: null,
        fileSaveError: null,
        isLoadingFile: false,
        isSavingFile: false,
        isReadOnly: true,
        isDeleted: true,
        largeFileWarning: null,
        activeTab: "diff",
        isLoaded: true,
      }));
      updateEditorSessionStatus(sessionId, "idle");
      await fetchEditorSessionDiff(sessionId, diffMode);
      return;
    }

    if (!editorRuntimeStateBySessionIdRef.current.get(sessionId)?.isLoaded) {
      await ensureEditorSessionLoaded(sessionId);
    }

    if (viewState.preferredTab === "diff" || viewState.changeEntry) {
      setEditorSessionActiveTab(sessionId, "diff");
      await fetchEditorSessionDiff(sessionId, diffMode);
      return;
    }

    setEditorSessionActiveTab(sessionId, "edit");
  }, [
    ensureEditorSessionLoaded,
    fetchEditorSessionDiff,
    setEditorSessionActiveTab,
    updateEditorRuntimeState,
    updateEditorSessionStatus,
  ]);

  const changeEditorSessionContent = useCallback((sessionId: string, next: string) => {
    updateEditorRuntimeState(sessionId, (current) => ({
      ...current,
      content: next,
      fileSaveError: null,
    }));

    const current = editorRuntimeStateBySessionIdRef.current.get(sessionId) ?? buildDefaultRuntimeState();
    updateEditorSessionStatus(
      sessionId,
      current.initialContent === next ? "idle" : "active",
    );
  }, [updateEditorRuntimeState, updateEditorSessionStatus]);

  const saveEditorSession = useCallback(async (sessionId: string) => {
    const session = editorSessionsRef.current.get(sessionId);
    const current = editorRuntimeStateBySessionIdRef.current.get(sessionId);
    if (
      !session
      || !current
      || current.isReadOnly
      || current.isDeleted
      || current.isSavingFile
      || !current.isLoaded
    ) {
      return;
    }

    updateEditorRuntimeState(sessionId, (previous) => ({
      ...previous,
      isSavingFile: true,
      fileSaveError: null,
    }));

    try {
      await writeTextFile(session.filePath, current.content);
      updateEditorRuntimeState(sessionId, (previous) => ({
        ...previous,
        initialContent: previous.content,
        isSavingFile: false,
        fileSaveError: null,
      }));
      updateEditorSessionStatus(sessionId, "idle");

      const nextState = editorRuntimeStateBySessionIdRef.current.get(sessionId);
      if (nextState?.diffMode) {
        await fetchEditorSessionDiff(sessionId, nextState.diffMode);
      }
    } catch (error) {
      updateEditorRuntimeState(sessionId, (previous) => ({
        ...previous,
        isSavingFile: false,
        fileSaveError: error instanceof Error ? error.message : "Failed to save file.",
      }));
    }
  }, [fetchEditorSessionDiff, updateEditorRuntimeState, updateEditorSessionStatus]);

  const openOrReuseEditorSession = useCallback((input: OpenOrReuseEditorSessionInput) => {
    const existing = findEditorSessionByFilePath(
      editorSessionsRef.current as unknown as Map<string, WorkspaceSession>,
      input.filePath,
    );
    if (existing) {
      updateEditorViewState(existing.id, input);
      return {
        session: existing,
        isExisting: true,
      };
    }

    const session = buildEditorSession({
      targetType: input.targetType,
      targetId: input.targetId,
      projectId: input.projectId,
      workspaceOwnerId: input.workspaceOwnerId,
      workspaceKey: input.workspaceKey,
      path: input.path,
      filePath: input.filePath,
    });

    setEditorSessions((previous) => {
      const next = new Map(previous);
      next.set(session.id, session);
      return next;
    });
    setEditorRuntimeStateBySessionId((previous) => {
      const next = new Map(previous);
      next.set(
        session.id,
        buildDefaultRuntimeState(input.preferredTab === "diff" ? "diff" : "edit"),
      );
      return next;
    });
    updateEditorViewState(session.id, input);

    return {
      session,
      isExisting: false,
    };
  }, [updateEditorViewState]);

  const closeEditorSession = useCallback((sessionId: string, options?: { skipConfirm?: boolean }) => {
    const session = editorSessionsRef.current.get(sessionId);
    if (!session) {
      return false;
    }

    const runtimeState = editorRuntimeStateBySessionIdRef.current.get(sessionId);
    if (!options?.skipConfirm && (session.status === "active" || isRuntimeDirty(runtimeState))) {
      const confirmed = window.confirm("Discard unsaved changes?");
      if (!confirmed) {
        return false;
      }
    }

    setEditorSessions((previous) => {
      if (!previous.has(sessionId)) {
        return previous;
      }
      const next = new Map(previous);
      next.delete(sessionId);
      return next;
    });
    setEditorViewStateBySessionId((previous) => {
      if (!previous.has(sessionId)) {
        return previous;
      }
      const next = new Map(previous);
      next.delete(sessionId);
      return next;
    });
    setEditorRuntimeStateBySessionId((previous) => {
      if (!previous.has(sessionId)) {
        return previous;
      }
      const next = new Map(previous);
      next.delete(sessionId);
      return next;
    });
    editorLoadRequestIdBySessionIdRef.current.delete(sessionId);
    return true;
  }, []);

  const closeMatchingSessions = useCallback((
    predicate: (session: EditorSession) => boolean,
    options?: { skipConfirm?: boolean },
  ) => {
    Array.from(editorSessionsRef.current.values())
      .filter(predicate)
      .forEach((session) => {
        closeEditorSession(session.id, options);
      });
  }, [closeEditorSession]);

  const closeSessionForFilePath = useCallback((filePath: string, options?: { skipConfirm?: boolean }) => {
    const existing = findEditorSessionByFilePath(
      editorSessionsRef.current as unknown as Map<string, WorkspaceSession>,
      filePath,
    );
    if (!existing) {
      return false;
    }

    return closeEditorSession(existing.id, options);
  }, [closeEditorSession]);

  return {
    editorSessions,
    setEditorSessions,
    editorViewStateBySessionId,
    editorRuntimeStateBySessionId,
    openOrReuseEditorSession,
    ensureEditorSessionLoaded,
    applyEditorSessionViewState,
    setEditorSessionActiveTab,
    changeEditorSessionContent,
    saveEditorSession,
    closeEditorSession,
    updateEditorSessionStatus,
    closeSessionsForProject: (projectId: number) => {
      closeMatchingSessions((session) => session.projectId === projectId, { skipConfirm: true });
    },
    closeSessionsForDivergence: (divergenceId: number) => {
      closeMatchingSessions((session) => session.targetType === "divergence" && session.targetId === divergenceId, { skipConfirm: true });
    },
    closeSessionsForWorkspace: (workspaceId: number) => {
      closeMatchingSessions((session) => session.targetType === "workspace" && session.targetId === workspaceId, { skipConfirm: true });
    },
    closeSessionsForWorkspaceDivergence: (workspaceDivergenceId: number) => {
      closeMatchingSessions((session) => session.targetType === "workspace_divergence" && session.targetId === workspaceDivergenceId, { skipConfirm: true });
    },
    closeSessionForFilePath,
  };
}
