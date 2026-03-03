import { useCallback, useState } from "react";
import {
  areSplitPaneSizesEqual,
  normalizeSplitPaneSizes,
} from "../../entities";
import type {
  SplitOrientation,
  SplitPaneId,
  SplitSessionState,
} from "../../entities";
import {
  buildNextSplitState,
  focusSplitPane,
} from "../lib/splitSession.pure";

export function useSplitPaneManagement() {
  const [splitBySessionId, setSplitBySessionId] = useState<Map<string, SplitSessionState>>(new Map());

  const handleSplitSession = useCallback((sessionId: string, orientation: SplitOrientation) => {
    setSplitBySessionId(prev => {
      const next = new Map(prev);
      const current = next.get(sessionId);
      next.set(sessionId, buildNextSplitState(current, orientation));
      return next;
    });
  }, []);

  const handleFocusSplitPane = useCallback((sessionId: string, paneId: SplitPaneId) => {
    setSplitBySessionId((prev) => {
      const current = prev.get(sessionId);
      if (!current) {
        return prev;
      }
      const nextState = focusSplitPane(current, paneId);
      if (nextState === current) {
        return prev;
      }
      const next = new Map(prev);
      next.set(sessionId, nextState);
      return next;
    });
  }, []);

  const handleResizeSplitPanes = useCallback((sessionId: string, paneSizes: number[]) => {
    setSplitBySessionId((prev) => {
      const current = prev.get(sessionId);
      if (!current || current.paneIds.length <= 1) {
        return prev;
      }
      const nextSizes = normalizeSplitPaneSizes(current.paneIds.length, paneSizes);
      const currentSizes = normalizeSplitPaneSizes(current.paneIds.length, current.paneSizes);
      if (areSplitPaneSizesEqual(currentSizes, nextSizes)) {
        return prev;
      }
      const next = new Map(prev);
      next.set(sessionId, {
        ...current,
        paneSizes: nextSizes,
      });
      return next;
    });
  }, []);

  const handleResetSplitSession = useCallback((sessionId: string) => {
    setSplitBySessionId(prev => {
      if (!prev.has(sessionId)) {
        return prev;
      }
      const next = new Map(prev);
      next.delete(sessionId);
      return next;
    });
  }, []);

  return {
    splitBySessionId,
    setSplitBySessionId,
    handleSplitSession,
    handleFocusSplitPane,
    handleResizeSplitPanes,
    handleResetSplitSession,
  };
}
