import { getDb } from "../hooks/useDatabase";
import { DEFAULT_TMUX_HISTORY_LIMIT, normalizeTmuxHistoryLimit } from "./appSettings";

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
export const DEFAULT_USE_WEBGL = true;
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
  const database = await getDb();
  const rows = await database.select<{
    copy_ignored_skip: string;
    use_tmux?: number;
    use_webgl?: number;
    tmux_history_limit?: number | null;
  }[]>(
    "SELECT copy_ignored_skip, use_tmux, use_webgl, tmux_history_limit FROM project_settings WHERE project_id = ?",
    [projectId]
  );

  if (!rows.length || !rows[0]?.copy_ignored_skip) {
    return {
      projectId,
      copyIgnoredSkip: DEFAULT_COPY_IGNORED_SKIP,
      useTmux: DEFAULT_USE_TMUX,
      useWebgl: DEFAULT_USE_WEBGL,
      tmuxHistoryLimit: null,
    };
  }

  try {
    const parsed = JSON.parse(rows[0].copy_ignored_skip);
    if (Array.isArray(parsed)) {
      const historyLimit = rows[0].tmux_history_limit;
      return {
        projectId,
        copyIgnoredSkip: normalizeSkipList(parsed.map(String)),
        useTmux: Boolean(rows[0].use_tmux ?? DEFAULT_USE_TMUX),
        useWebgl: Boolean(rows[0].use_webgl ?? DEFAULT_USE_WEBGL),
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
    useWebgl: DEFAULT_USE_WEBGL,
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
  const database = await getDb();
  await database.execute(
    `
      INSERT INTO project_settings (project_id, copy_ignored_skip, use_tmux, use_webgl, tmux_history_limit)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(project_id) DO UPDATE SET
        copy_ignored_skip = excluded.copy_ignored_skip,
        use_tmux = excluded.use_tmux,
        use_webgl = excluded.use_webgl,
        tmux_history_limit = excluded.tmux_history_limit
    `,
    [
      projectId,
      JSON.stringify(normalized),
      useTmux ? 1 : 0,
      useWebgl ? 1 : 0,
      normalizedHistoryLimit,
    ]
  );

  return {
    projectId,
    copyIgnoredSkip: normalized,
    useTmux,
    useWebgl,
    tmuxHistoryLimit: normalizedHistoryLimit,
  };
}
