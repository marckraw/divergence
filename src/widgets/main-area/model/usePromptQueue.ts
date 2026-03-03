import { useCallback, useEffect, useState } from "react";
import {
  clearPromptQueueItems,
  deletePromptQueueItem,
  enqueuePromptQueueItem,
  listPromptQueueItems,
  type PromptQueueItemRow,
  type PromptQueueScopeType,
} from "../../../entities/prompt-queue";

interface PromptQueueScope {
  scopeType: PromptQueueScopeType;
  scopeId: number;
}

interface UsePromptQueueParams {
  queueScope: PromptQueueScope | null;
  activePaneSessionIdRef: React.MutableRefObject<string | null>;
  onSendPromptToSession: (sessionId: string, prompt: string) => Promise<void>;
}

export function usePromptQueue({
  queueScope,
  activePaneSessionIdRef,
  onSendPromptToSession,
}: UsePromptQueueParams) {
  const [queueItems, setQueueItems] = useState<PromptQueueItemRow[]>([]);
  const [queueDraft, setQueueDraft] = useState("");
  const [queueLoading, setQueueLoading] = useState(false);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [queueingPrompt, setQueueingPrompt] = useState(false);
  const [queueActionItemId, setQueueActionItemId] = useState<number | null>(null);
  const [queueSendingItemId, setQueueSendingItemId] = useState<number | null>(null);

  useEffect(() => {
    if (!queueScope) {
      setQueueItems([]);
      setQueueDraft("");
      setQueueLoading(false);
      setQueueError(null);
      setQueueingPrompt(false);
      setQueueActionItemId(null);
      setQueueSendingItemId(null);
      return;
    }

    let cancelled = false;

    const loadQueue = async () => {
      setQueueLoading(true);
      try {
        const items = await listPromptQueueItems(queueScope.scopeType, queueScope.scopeId);
        if (!cancelled) {
          setQueueItems(items);
          setQueueError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setQueueError(error instanceof Error ? error.message : "Failed to load prompt queue.");
        }
      } finally {
        if (!cancelled) {
          setQueueLoading(false);
        }
      }
    };

    void loadQueue();
    return () => {
      cancelled = true;
    };
  }, [queueScope]);

  const handleQueuePrompt = useCallback(async () => {
    if (!queueScope) {
      return;
    }
    const prompt = queueDraft.trim();
    if (!prompt) {
      return;
    }

    setQueueingPrompt(true);
    try {
      await enqueuePromptQueueItem({
        scopeType: queueScope.scopeType,
        scopeId: queueScope.scopeId,
        prompt,
      });
      const items = await listPromptQueueItems(queueScope.scopeType, queueScope.scopeId);
      setQueueItems(items);
      setQueueDraft("");
      setQueueError(null);
    } catch (error) {
      setQueueError(error instanceof Error ? error.message : "Failed to queue prompt.");
    } finally {
      setQueueingPrompt(false);
    }
  }, [queueDraft, queueScope]);

  const handleQueueRemoveItem = useCallback(async (itemId: number) => {
    setQueueActionItemId(itemId);
    try {
      await deletePromptQueueItem(itemId);
      setQueueItems((prev) => prev.filter((item) => item.id !== itemId));
      setQueueError(null);
    } catch (error) {
      setQueueError(error instanceof Error ? error.message : "Failed to remove queued prompt.");
    } finally {
      setQueueActionItemId((prev) => (prev === itemId ? null : prev));
    }
  }, []);

  const handleQueueClear = useCallback(async () => {
    if (!queueScope) {
      return;
    }
    setQueueLoading(true);
    try {
      await clearPromptQueueItems(queueScope.scopeType, queueScope.scopeId);
      setQueueItems([]);
      setQueueError(null);
    } catch (error) {
      setQueueError(error instanceof Error ? error.message : "Failed to clear prompt queue.");
    } finally {
      setQueueLoading(false);
    }
  }, [queueScope]);

  const handleQueueSendItem = useCallback(async (itemId: number) => {
    const item = queueItems.find((current) => current.id === itemId);
    const currentSessionId = activePaneSessionIdRef.current;
    if (!currentSessionId) {
      setQueueError("No active terminal session. Open a session first.");
      return;
    }
    if (!item) {
      return;
    }

    setQueueSendingItemId(itemId);
    try {
      await onSendPromptToSession(currentSessionId, item.prompt);
      await deletePromptQueueItem(itemId);
      setQueueItems((prev) => prev.filter((current) => current.id !== itemId));
      setQueueError(null);
    } catch (error) {
      setQueueError(error instanceof Error ? error.message : "Failed to send queued prompt.");
    } finally {
      setQueueSendingItemId((prev) => (prev === itemId ? null : prev));
    }
  }, [onSendPromptToSession, queueItems, activePaneSessionIdRef]);

  return {
    queueItems,
    queueDraft,
    queueLoading,
    queueError,
    queueingPrompt,
    queueActionItemId,
    queueSendingItemId,
    setQueueDraft,
    handleQueuePrompt,
    handleQueueRemoveItem,
    handleQueueClear,
    handleQueueSendItem,
  };
}
