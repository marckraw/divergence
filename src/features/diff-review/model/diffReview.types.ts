import type { ChangesMode } from "../../../entities";

export type DiffReviewAgent = "claude" | "codex";

export type DiffReviewLineKind = "added" | "removed" | "range" | "file";

export interface DiffReviewAnchor {
  filePath: string;
  mode: ChangesMode;
  lineKind: DiffReviewLineKind;
  newLine?: number;
  oldLine?: number;
  endNewLine?: number;
  endOldLine?: number;
  displayLineIndex: number;
  endDisplayLineIndex?: number;
  lineText?: string;
  endLineText?: string;
  stale?: boolean;
}

export interface DiffReviewComment {
  id: string;
  anchor: DiffReviewAnchor;
  message: string;
  createdAt: string;
}

export interface DiffReviewDraft {
  workspacePath: string;
  mode: ChangesMode;
  comments: DiffReviewComment[];
  finalComment: string;
  agent: DiffReviewAgent;
}

export interface ParsedDiffLine {
  index: number;
  text: string;
  kind: "meta" | "hunk" | "context" | "added" | "removed";
  oldLine?: number;
  newLine?: number;
}

export interface ReviewBriefBuildInput {
  workspacePath: string;
  mode: ChangesMode;
  comments: DiffReviewComment[];
  finalComment: string;
}
