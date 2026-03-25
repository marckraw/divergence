import {
  Fragment,
  useCallback,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import type {
  SplitPaneId,
  SplitSessionState,
  TerminalSession,
} from "../../../entities";
import {
  buildEqualSplitPaneSizes,
  normalizeSplitPaneSizes,
  resizeSplitPaneSizes,
} from "../../../entities";
import { buildSplitTmuxSessionName } from "../../../entities/terminal-session";
import type { TerminalContextSelectionRequest } from "../../../widgets/main-area";
import Terminal from "../../../widgets/main-area/ui/Terminal.container";
import { getAggregatedTerminalStatus } from "../../../widgets/main-area/lib/mainArea.pure";

interface TerminalStagePaneProps {
  session: TerminalSession;
  isStageFocused: boolean;
  splitBySessionId: Map<string, SplitSessionState>;
  reconnectBySessionId: Map<string, number>;
  onCloseSession: (sessionId: string) => void;
  onStatusChange: (sessionId: string, status: TerminalSession["status"]) => void;
  onRegisterTerminalCommand: (sessionId: string, sendCommand: (command: string) => void) => void;
  onUnregisterTerminalCommand: (sessionId: string) => void;
  onAddTerminalContextRequest?: (selection: TerminalContextSelectionRequest) => void;
  onFocusSplitPane: (sessionId: string, paneId: SplitPaneId) => void;
  onResizeSplitPanes: (sessionId: string, paneSizes: number[]) => void;
  onReconnectSession: (sessionId: string) => void;
}

function TerminalStagePane({
  session,
  isStageFocused,
  splitBySessionId,
  reconnectBySessionId,
  onCloseSession,
  onStatusChange,
  onRegisterTerminalCommand,
  onUnregisterTerminalCommand,
  onAddTerminalContextRequest,
  onFocusSplitPane,
  onResizeSplitPanes,
  onReconnectSession,
}: TerminalStagePaneProps) {
  const paneStatusRef = useRef<
    Map<string, Map<SplitPaneId, TerminalSession["status"]>>
  >(new Map());
  const [isDraggingSplitPane, setIsDraggingSplitPane] = useState(false);

  const handleStatusChange = useCallback(
    (sessionId: string) => (status: TerminalSession["status"]) => {
      onStatusChange(sessionId, status);
    },
    [onStatusChange],
  );

  const handleSplitStatusChange = useCallback(
    (sessionId: string, paneId: SplitPaneId) => (status: TerminalSession["status"]) => {
      const allowedPaneIds = splitBySessionId.get(sessionId)?.paneIds ?? ["pane-1"];
      const existing = paneStatusRef.current.get(sessionId) ?? new Map<SplitPaneId, TerminalSession["status"]>();
      const next = new Map<SplitPaneId, TerminalSession["status"]>();
      for (const allowedPaneId of allowedPaneIds) {
        if (allowedPaneId === paneId) {
          continue;
        }
        const existingStatus = existing.get(allowedPaneId);
        if (existingStatus) {
          next.set(allowedPaneId, existingStatus);
        }
      }
      next.set(paneId, status);
      paneStatusRef.current.set(sessionId, next);
      onStatusChange(sessionId, getAggregatedTerminalStatus(Array.from(next.values())));
    },
    [onStatusChange, splitBySessionId],
  );

  const handleSplitPaneResizeDragStart = useCallback((
    event: ReactMouseEvent<HTMLDivElement>,
    sessionId: string,
    orientation: SplitSessionState["orientation"],
    dividerIndex: number,
    paneSizes: number[],
  ) => {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();

    const container = event.currentTarget.parentElement;
    if (!container) {
      return;
    }
    const containerRect = container.getBoundingClientRect();
    const containerSize = orientation === "vertical" ? containerRect.width : containerRect.height;
    if (containerSize <= 0) {
      return;
    }

    const startPointer = orientation === "vertical" ? event.clientX : event.clientY;
    const startSizes = [...paneSizes];
    setIsDraggingSplitPane(true);
    document.body.style.userSelect = "none";
    document.body.style.cursor = orientation === "vertical" ? "col-resize" : "row-resize";

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const pointer = orientation === "vertical" ? moveEvent.clientX : moveEvent.clientY;
      const deltaRatio = (pointer - startPointer) / containerSize;
      const nextSizes = resizeSplitPaneSizes(startSizes, dividerIndex, deltaRatio);
      onResizeSplitPanes(sessionId, nextSizes);
    };

    const handleMouseUp = () => {
      setIsDraggingSplitPane(false);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [onResizeSplitPanes]);

  const handleSplitPaneResizeReset = useCallback((sessionId: string, paneCount: number) => {
    onResizeSplitPanes(sessionId, buildEqualSplitPaneSizes(paneCount));
  }, [onResizeSplitPanes]);

  const splitState = splitBySessionId.get(session.id) ?? null;
  const paneIds = splitState?.paneIds.length ? splitState.paneIds : (["pane-1"] as SplitPaneId[]);
  const isSplit = paneIds.length > 1;
  const orientation: SplitSessionState["orientation"] = splitState?.orientation ?? "vertical";
  const layoutClass = orientation === "vertical" ? "flex-row" : "flex-col";
  const paneSizes = isSplit
    ? normalizeSplitPaneSizes(paneIds.length, splitState?.paneSizes)
    : [1];
  const reconnectToken = reconnectBySessionId.get(session.id) ?? 0;

  return (
    <div className={`flex h-full w-full ${layoutClass}`}>
      {paneIds.map((paneId, index) => {
        const isPrimaryPane = paneId === (splitState?.primaryPaneId ?? "pane-1");
        const paneSessionId = isPrimaryPane ? session.id : `${session.id}-${paneId}`;
        const paneTmuxName = paneId === "pane-1" || !session.useTmux
          ? session.tmuxSessionName
          : buildSplitTmuxSessionName(session.tmuxSessionName, paneId);
        const withDivider = index < paneIds.length - 1;
        const isFocusedSplitPane = paneId === (splitState?.focusedPaneId ?? "pane-1");
        const paneSize = paneSizes[index] ?? 1 / paneIds.length;
        const isFocused = isSplit ? isStageFocused && isFocusedSplitPane : isStageFocused;

        return (
          <Fragment key={`${session.id}-${paneId}-wrapper`}>
            <div
              className={`relative overflow-hidden min-w-0 min-h-0 ${
                isSplit ? "" : "flex-1"
              } ${
                isSplit && !isDraggingSplitPane
                  ? "transition-[flex-grow] duration-150 ease-out"
                  : ""
              } ${
                isSplit
                  ? isFocused
                    ? "border border-accent/70 ring-1 ring-inset ring-accent/30 shadow-lg shadow-accent/10 transition-[border-color,box-shadow,opacity] duration-150"
                    : "border border-surface/80 opacity-85 transition-[border-color,box-shadow,opacity] duration-150"
                  : ""
              }`}
              style={isSplit ? {
                flexBasis: 0,
                flexGrow: paneSize,
                flexShrink: 1,
              } : undefined}
              onMouseDown={() => onFocusSplitPane(session.id, paneId)}
            >
              <Terminal
                key={`${paneSessionId}-${paneTmuxName}-${reconnectToken}`}
                cwd={session.path}
                sessionId={paneSessionId}
                useTmux={session.useTmux}
                tmuxSessionName={paneTmuxName}
                tmuxHistoryLimit={session.tmuxHistoryLimit}
                portEnv={session.portEnv}
                isFocused={isFocused}
                onStatusChange={isSplit ? handleSplitStatusChange(session.id, paneId) : handleStatusChange(session.id)}
                onReconnect={() => onReconnectSession(session.id)}
                onRegisterCommand={onRegisterTerminalCommand}
                onUnregisterCommand={onUnregisterTerminalCommand}
                onAddTerminalContextRequest={onAddTerminalContextRequest
                  ? (selection) => {
                    onAddTerminalContextRequest({
                      sourceSessionId: session.id,
                      sourceSessionName: session.name,
                      ...selection,
                    });
                  }
                  : undefined}
                onClose={() => onCloseSession(session.id)}
              />
            </div>
            {withDivider && (
              <div
                className={orientation === "vertical"
                  ? "h-full w-1 shrink-0 cursor-col-resize border-l border-surface bg-transparent hover:bg-accent/30 active:bg-accent/50 transition-colors"
                  : "w-full h-1 shrink-0 cursor-row-resize border-t border-surface bg-transparent hover:bg-accent/30 active:bg-accent/50 transition-colors"
                }
                onMouseDown={(event) => handleSplitPaneResizeDragStart(
                  event,
                  session.id,
                  orientation,
                  index,
                  paneSizes,
                )}
                onDoubleClick={() => handleSplitPaneResizeReset(session.id, paneIds.length)}
              />
            )}
          </Fragment>
        );
      })}
    </div>
  );
}

export default TerminalStagePane;
