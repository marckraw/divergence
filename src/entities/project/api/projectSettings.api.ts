import { eq } from "drizzle-orm";
import { db } from "../../../shared/api/drizzle.api";
import { projectSettings } from "../../../shared/api/schema.types";
import {
  DEFAULT_TMUX_HISTORY_LIMIT,
  normalizeTmuxHistoryLimit,
} from "../../../shared/lib/appSettings.pure";

export const DEFAULT_COPY_IGNORED_SKIP = [
  "node_modules",
  "dist",
  "build",
  "target",
  ".turbo",
  ".next",
  ".cache",
];
export const DEFAULT_USE_TMUX = true;
export { DEFAULT_TMUX_HISTORY_LIMIT };

export interface ProjectSettings {
  projectId: number;
  copyIgnoredSkip: string[];
  useTmux: boolean;
  useWebgl: boolean;
  tmuxHistoryLimit: number | null;
}

export function normalizeSkipList(entries: string[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const entry of entries) {
    const trimmed = entry.trim();
    if (!trimmed) {
      continue;
    }
    if (seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    result.push(trimmed);
  }

  return result;
}

export async function loadProjectSettings(projectId: number): Promise<ProjectSettings> {
  const rows = await db
    .select()
    .from(projectSettings)
    .where(eq(projectSettings.projectId, projectId));

  const row = rows[0];
  if (!row?.copyIgnoredSkip) {
    return {
      projectId,
      copyIgnoredSkip: DEFAULT_COPY_IGNORED_SKIP,
      useTmux: DEFAULT_USE_TMUX,
      useWebgl: true,
      tmuxHistoryLimit: null,
    };
  }

  try {
    const parsed = JSON.parse(row.copyIgnoredSkip);
    if (Array.isArray(parsed)) {
      const historyLimit = row.tmuxHistoryLimit;
      return {
        projectId,
        copyIgnoredSkip: normalizeSkipList(parsed.map(String)),
        useTmux: row.useTmux ?? DEFAULT_USE_TMUX,
        useWebgl: row.useWebgl ?? true,
        tmuxHistoryLimit: historyLimit === null || historyLimit === undefined
          ? null
          : normalizeTmuxHistoryLimit(historyLimit, DEFAULT_TMUX_HISTORY_LIMIT),
      };
    }
  } catch {
    // Fall back to defaults if parsing fails
  }

  return {
    projectId,
    copyIgnoredSkip: DEFAULT_COPY_IGNORED_SKIP,
    useTmux: DEFAULT_USE_TMUX,
    useWebgl: true,
    tmuxHistoryLimit: null,
  };
}

export async function saveProjectSettings(
  projectId: number,
  copyIgnoredSkip: string[],
  useTmux: boolean,
  useWebgl: boolean,
  tmuxHistoryLimit: number | null
): Promise<ProjectSettings> {
  const normalized = normalizeSkipList(copyIgnoredSkip);
  const normalizedHistoryLimit = tmuxHistoryLimit === null
    ? null
    : normalizeTmuxHistoryLimit(tmuxHistoryLimit, DEFAULT_TMUX_HISTORY_LIMIT);

  await db
    .insert(projectSettings)
    .values({
      projectId,
      copyIgnoredSkip: JSON.stringify(normalized),
      useTmux,
      useWebgl,
      tmuxHistoryLimit: normalizedHistoryLimit,
    })
    .onConflictDoUpdate({
      target: projectSettings.projectId,
      set: {
        copyIgnoredSkip: JSON.stringify(normalized),
        useTmux,
        useWebgl,
        tmuxHistoryLimit: normalizedHistoryLimit,
      },
    });

  return {
    projectId,
    copyIgnoredSkip: normalized,
    useTmux,
    useWebgl,
    tmuxHistoryLimit: normalizedHistoryLimit,
  };
}
