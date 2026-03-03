import type { GithubPrChatContextInput } from "../model/githubPrChat.types";

const MAX_FILES_WITH_PATCH = 20;
const MAX_PATCH_LINES_PER_FILE = 400;
const MAX_TOTAL_PATCH_LINES = 6000;
const MAX_FILE_SUMMARY_ROWS = 200;

interface PatchChunk {
  filename: string;
  text: string;
  totalLines: number;
  shownLines: number;
}

function splitLines(input: string): string[] {
  return input.split("\n");
}

function buildPatchChunk(filename: string, patch: string, maxLines: number): PatchChunk {
  const lines = splitLines(patch);
  const shownLines = Math.min(lines.length, maxLines);
  return {
    filename,
    text: lines.slice(0, shownLines).join("\n"),
    totalLines: lines.length,
    shownLines,
  };
}

function buildFileSummaryRows(input: GithubPrChatContextInput): string[] {
  return input.files
    .slice(0, MAX_FILE_SUMMARY_ROWS)
    .map((file) => `- ${file.filename} (${file.status}) +${file.additions} / -${file.deletions}`);
}

function buildFocusedPatchChunks(input: GithubPrChatContextInput): PatchChunk[] {
  if (!input.selectedFilePath) {
    return [];
  }
  const selected = input.files.find((file) => file.filename === input.selectedFilePath);
  if (!selected?.patch?.trim()) {
    return [];
  }
  return [buildPatchChunk(selected.filename, selected.patch, MAX_PATCH_LINES_PER_FILE)];
}

function buildExpandedPatchChunks(input: GithubPrChatContextInput): PatchChunk[] {
  const chunks: PatchChunk[] = [];
  let remainingBudget = MAX_TOTAL_PATCH_LINES;

  const selected = input.selectedFilePath
    ? input.files.find((file) => file.filename === input.selectedFilePath) ?? null
    : null;
  const ordered = selected
    ? [selected, ...input.files.filter((file) => file.filename !== selected.filename)]
    : input.files;

  for (const file of ordered) {
    if (!file.patch?.trim()) {
      continue;
    }
    if (chunks.length >= MAX_FILES_WITH_PATCH || remainingBudget <= 0) {
      break;
    }

    const lines = splitLines(file.patch);
    const perFileCap = Math.min(MAX_PATCH_LINES_PER_FILE, remainingBudget);
    const shownLines = Math.min(lines.length, perFileCap);
    chunks.push({
      filename: file.filename,
      text: lines.slice(0, shownLines).join("\n"),
      totalLines: lines.length,
      shownLines,
    });
    remainingBudget -= shownLines;
  }

  return chunks;
}

export function buildGithubPrChatContextMarkdown(input: GithubPrChatContextInput): string {
  const lines: string[] = [];

  lines.push("# Pull Request Context");
  lines.push("");
  lines.push("## PR Metadata");
  lines.push(`- Repo: ${input.pullRequest.repoKey}`);
  lines.push(`- Number: #${input.pullRequest.number}`);
  lines.push(`- Title: ${input.detail.title}`);
  lines.push(`- URL: ${input.detail.htmlUrl}`);
  lines.push(`- Author: ${input.detail.userLogin ? `@${input.detail.userLogin}` : "unknown"}`);
  lines.push(`- State: ${input.detail.state}${input.detail.draft ? " (draft)" : ""}`);
  lines.push(`- Checks: ${input.detail.checksState ?? "unknown"}`);
  lines.push(`- Base: ${input.detail.baseRef}`);
  lines.push(`- Head: ${input.detail.headRef}`);
  lines.push(`- Commits: ${input.detail.commits}`);
  lines.push(`- Changed files: ${input.detail.changedFiles}`);
  lines.push(`- Additions/Deletions: +${input.detail.additions} / -${input.detail.deletions}`);
  lines.push("");
  lines.push("## PR Description");
  lines.push(input.detail.body?.trim() ? input.detail.body.trim() : "(no description provided)");
  lines.push("");
  lines.push("## Changed Files Summary");
  lines.push(...buildFileSummaryRows(input));
  lines.push("");

  const chunks = input.includeAllPatches
    ? buildExpandedPatchChunks(input)
    : buildFocusedPatchChunks(input);

  if (input.includeAllPatches) {
    lines.push("## Patch Context Mode");
    lines.push("Expanded (include multiple changed file patches)");
    lines.push("");
  } else {
    lines.push("## Patch Context Mode");
    lines.push("Focused (selected file patch only)");
    lines.push("");
  }

  if (chunks.length === 0) {
    lines.push("No patch context included (no patch available for current selection/files).");
    lines.push("");
    return lines.join("\n");
  }

  lines.push("## Patch Excerpts");
  lines.push("");
  for (const chunk of chunks) {
    lines.push(`### ${chunk.filename}`);
    if (chunk.shownLines < chunk.totalLines) {
      lines.push(
        `_truncated: showing ${chunk.shownLines}/${chunk.totalLines} lines for this file_`,
      );
    }
    lines.push("```diff");
    lines.push(chunk.text);
    lines.push("```");
    lines.push("");
  }

  const shownTotal = chunks.reduce((sum, chunk) => sum + chunk.shownLines, 0);
  const totalLines = chunks.reduce((sum, chunk) => sum + chunk.totalLines, 0);
  if (shownTotal < totalLines) {
    lines.push(`_global truncation applied: showing ${shownTotal}/${totalLines} patch lines_`);
    lines.push("");
  }

  return lines.join("\n");
}
