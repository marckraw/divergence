import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { ChangesMode, GitChangeEntry, GitChangeStatus } from "../../../entities";
import { getRelativePathFromRoot, sortGitChangesByPath } from "../../../lib/utils/changes";

interface BranchChangesResponse {
  base_ref: string | null;
  changes: GitChangeEntry[];
}

interface ChangesPanelProps {
  rootPath: string | null;
  activeFilePath?: string | null;
  mode: ChangesMode;
  onModeChange: (mode: ChangesMode) => void;
  onOpenChange: (entry: GitChangeEntry) => void;
}

const STATUS_STYLES: Record<
  GitChangeStatus,
  { label: string; className: string; textClassName: string }
> = {
  A: { label: "A", className: "bg-green/20", textClassName: "text-green" },
  M: { label: "M", className: "bg-yellow/20", textClassName: "text-yellow" },
  D: { label: "D", className: "bg-red/20", textClassName: "text-red" },
  R: { label: "R", className: "bg-accent/20", textClassName: "text-accent" },
  C: { label: "C", className: "bg-accent/20", textClassName: "text-accent" },
  U: { label: "U", className: "bg-red/20", textClassName: "text-red" },
  "?": { label: "?", className: "bg-surface", textClassName: "text-subtext" },
};

function ChangesPanel({ rootPath, activeFilePath, mode, onModeChange, onOpenChange }: ChangesPanelProps) {
  const [changes, setChanges] = useState<GitChangeEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [baseRef, setBaseRef] = useState<string | null>(null);

  const activeRelative = useMemo(() => {
    if (!rootPath || !activeFilePath) return null;
    return getRelativePathFromRoot(rootPath, activeFilePath);
  }, [rootPath, activeFilePath]);

  const loadChanges = useCallback(async () => {
    if (!rootPath) {
      setChanges([]);
      setError(null);
      setBaseRef(null);
      return;
    }

    try {
      setLoading(true);
      if (mode === "branch") {
        const result = await invoke<BranchChangesResponse>("list_branch_changes", { path: rootPath });
        const sorted = sortGitChangesByPath(result.changes);
        setChanges(sorted);
        setBaseRef(result.base_ref);
      } else {
        const result = await invoke<GitChangeEntry[]>("list_git_changes", { path: rootPath });
        const sorted = sortGitChangesByPath(result);
        setChanges(sorted);
        setBaseRef(null);
      }
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load changes.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [rootPath, mode]);

  useEffect(() => {
    loadChanges();
  }, [loadChanges]);

  useEffect(() => {
    const handleFocus = () => {
      loadChanges();
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [loadChanges]);

  if (!rootPath) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-subtext">
        Select a project to see changes.
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-surface">
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded bg-surface text-xs">
            <button
              type="button"
              className={`px-2 py-1 rounded transition-colors ${
                mode === "working"
                  ? "bg-accent text-white"
                  : "text-subtext hover:text-text"
              }`}
              onClick={() => onModeChange("working")}
            >
              Working
            </button>
            <button
              type="button"
              className={`px-2 py-1 rounded transition-colors ${
                mode === "branch"
                  ? "bg-accent text-white"
                  : "text-subtext hover:text-text"
              }`}
              onClick={() => onModeChange("branch")}
            >
              Branch
            </button>
          </div>
        </div>
        <button
          type="button"
          className="text-xs text-subtext hover:text-text"
          onClick={loadChanges}
          disabled={loading}
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>
      {mode === "branch" && (
        <div className="px-3 py-1.5 border-b border-surface">
          {baseRef ? (
            <span className="text-[10px] text-subtext">
              vs <span className="text-text font-medium">{baseRef}</span>
            </span>
          ) : (
            <span className="text-[10px] text-subtext">No base branch detected</span>
          )}
        </div>
      )}
      <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1">
        {error && (
          <div className="px-2 py-2 text-xs text-red bg-red/10 border border-red/30 rounded">
            {error}
          </div>
        )}
        {!error && !loading && changes.length === 0 && (
          <div className="px-2 py-8 text-center text-xs text-subtext">
            {mode === "branch" && !baseRef
              ? "No base branch detected."
              : "No changes yet."}
          </div>
        )}
        {changes.map((entry) => {
          const statusStyle = STATUS_STYLES[entry.status] ?? STATUS_STYLES["?"];
          const isActive = activeRelative === entry.path;
          return (
            <button
              key={`${entry.status}-${entry.path}`}
              type="button"
              onClick={() => onOpenChange(entry)}
              className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded transition-colors ${
                isActive ? "bg-surface" : "hover:bg-surface/50"
              }`}
            >
              <span
                className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${statusStyle.className} ${statusStyle.textClassName}`}
              >
                {statusStyle.label}
              </span>
              <div className="flex-1 min-w-0">
                {entry.old_path ? (
                  <div className="text-xs text-text truncate">
                    {entry.old_path} → {entry.path}
                  </div>
                ) : (
                  <div className="text-xs text-text truncate">{entry.path}</div>
                )}
                {mode === "working" && (
                  <div className="text-[10px] text-subtext/70 mt-0.5 flex items-center gap-1">
                    {entry.staged && <span className="px-1 rounded bg-surface">staged</span>}
                    {entry.unstaged && <span className="px-1 rounded bg-surface">unstaged</span>}
                    {entry.untracked && <span className="px-1 rounded bg-surface">untracked</span>}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default ChangesPanel;
