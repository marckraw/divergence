import { useCallback, useMemo, useState } from "react";
import type { ChangesMode } from "../../../entities";
import type {
  DiffReviewAgent,
  DiffReviewAnchor,
  DiffReviewComment,
  DiffReviewDraft,
} from "./diffReview.types";

interface UseDiffReviewDraftInput {
  workspacePath: string | null;
  mode: ChangesMode;
}

interface DraftMapValue {
  comments: DiffReviewComment[];
  finalComment: string;
  agent: DiffReviewAgent;
}

const DEFAULT_AGENT: DiffReviewAgent = "claude";

function getDraftKey(workspacePath: string, mode: ChangesMode): string {
  return `${workspacePath}::${mode}`;
}

function createComment(anchor: DiffReviewAnchor, message: string): DiffReviewComment {
  return {
    id: typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    anchor,
    message: message.trim(),
    createdAt: new Date().toISOString(),
  };
}

export function useDiffReviewDraft({ workspacePath, mode }: UseDiffReviewDraftInput) {
  const [draftByKey, setDraftByKey] = useState<Record<string, DraftMapValue>>({});

  const activeKey = useMemo(() => {
    if (!workspacePath) {
      return null;
    }
    return getDraftKey(workspacePath, mode);
  }, [workspacePath, mode]);

  const activeDraft = useMemo((): DiffReviewDraft | null => {
    if (!workspacePath || !activeKey) {
      return null;
    }

    const existing = draftByKey[activeKey];
    return {
      workspacePath,
      mode,
      comments: existing?.comments ?? [],
      finalComment: existing?.finalComment ?? "",
      agent: existing?.agent ?? DEFAULT_AGENT,
    };
  }, [activeKey, draftByKey, mode, workspacePath]);

  const addComment = useCallback((anchor: DiffReviewAnchor, message: string) => {
    if (!activeKey || !workspacePath || !message.trim()) {
      return;
    }

    setDraftByKey((previous) => {
      const current = previous[activeKey] ?? {
        comments: [],
        finalComment: "",
        agent: DEFAULT_AGENT,
      };

      return {
        ...previous,
        [activeKey]: {
          ...current,
          comments: [...current.comments, createComment(anchor, message)],
        },
      };
    });
  }, [activeKey, workspacePath]);

  const removeComment = useCallback((commentId: string) => {
    if (!activeKey) {
      return;
    }

    setDraftByKey((previous) => {
      const current = previous[activeKey];
      if (!current) {
        return previous;
      }

      return {
        ...previous,
        [activeKey]: {
          ...current,
          comments: current.comments.filter((comment) => comment.id !== commentId),
        },
      };
    });
  }, [activeKey]);

  const setFinalComment = useCallback((value: string) => {
    if (!activeKey) {
      return;
    }

    setDraftByKey((previous) => {
      const current = previous[activeKey] ?? {
        comments: [],
        finalComment: "",
        agent: DEFAULT_AGENT,
      };

      return {
        ...previous,
        [activeKey]: {
          ...current,
          finalComment: value,
        },
      };
    });
  }, [activeKey]);

  const setAgent = useCallback((agent: DiffReviewAgent) => {
    if (!activeKey) {
      return;
    }

    setDraftByKey((previous) => {
      const current = previous[activeKey] ?? {
        comments: [],
        finalComment: "",
        agent: DEFAULT_AGENT,
      };

      return {
        ...previous,
        [activeKey]: {
          ...current,
          agent,
        },
      };
    });
  }, [activeKey]);

  const clearActiveDraft = useCallback(() => {
    if (!activeKey) {
      return;
    }

    setDraftByKey((previous) => {
      const next = { ...previous };
      delete next[activeKey];
      return next;
    });
  }, [activeKey]);

  const clearAllDrafts = useCallback(() => {
    setDraftByKey({});
  }, []);

  return {
    activeDraft,
    addComment,
    removeComment,
    setFinalComment,
    setAgent,
    clearActiveDraft,
    clearAllDrafts,
  };
}
