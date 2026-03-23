import type {
  DiffReviewAnchor,
  DiffReviewComment,
  ReviewBriefBuildInput,
} from "../model/diffReview.types";
export { parseUnifiedDiffLines } from "../../../shared";

interface DiffReviewGroup {
  filePath: string;
  comments: DiffReviewComment[];
}

export function buildAnchorLabel(anchor: DiffReviewAnchor): string {
  if (anchor.lineKind === "file") {
    return "File-level";
  }
  if (anchor.lineKind === "range") {
    const start = anchor.newLine !== undefined
      ? `+${anchor.newLine}`
      : anchor.oldLine !== undefined
        ? `-${anchor.oldLine}`
        : `L${anchor.displayLineIndex + 1}`;
    const end = anchor.endNewLine !== undefined
      ? `+${anchor.endNewLine}`
      : anchor.endOldLine !== undefined
        ? `-${anchor.endOldLine}`
        : `L${(anchor.endDisplayLineIndex ?? anchor.displayLineIndex) + 1}`;
    return `${start}..${end}`;
  }
  if (anchor.lineKind === "added") {
    return `+${anchor.newLine ?? "?"}`;
  }
  return `-${anchor.oldLine ?? "?"}`;
}

export function groupCommentsByFile(comments: DiffReviewComment[]): DiffReviewGroup[] {
  const grouped = new Map<string, DiffReviewComment[]>();

  comments.forEach((comment) => {
    const list = grouped.get(comment.anchor.filePath) ?? [];
    list.push(comment);
    grouped.set(comment.anchor.filePath, list);
  });

  return Array.from(grouped.entries())
    .map(([filePath, list]) => ({
      filePath,
      comments: [...list].sort((a, b) => a.anchor.displayLineIndex - b.anchor.displayLineIndex),
    }))
    .sort((a, b) => a.filePath.localeCompare(b.filePath));
}

export function buildReviewBriefMarkdown(input: ReviewBriefBuildInput): string {
  const groups = groupCommentsByFile(input.comments);
  const lines: string[] = [];

  lines.push("# Diff Review Brief");
  lines.push("");
  lines.push(`- Workspace: ${input.workspacePath}`);
  lines.push(`- Mode: ${input.mode}`);
  lines.push(`- Total comments: ${input.comments.length}`);
  lines.push("");

  if (input.comments.length === 0) {
    lines.push("No inline comments were added.");
    lines.push("");
  } else {
    lines.push("## Inline Comments");
    lines.push("");

    groups.forEach((group) => {
      lines.push(`### ${group.filePath}`);
      lines.push("");

      group.comments.forEach((comment) => {
        const anchorLabel = buildAnchorLabel(comment.anchor);
        const staleLabel = comment.anchor.stale ? " (stale)" : "";
        lines.push(`- [${anchorLabel}]${staleLabel} ${comment.message}`);
      });

      lines.push("");
    });
  }

  lines.push("## Final Comment");
  lines.push("");
  lines.push(input.finalComment.trim() || "(none)");

  return lines.join("\n");
}
