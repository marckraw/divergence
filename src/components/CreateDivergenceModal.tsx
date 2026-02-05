import { useState, useCallback, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import Database from "@tauri-apps/plugin-sql";
import { motion, useReducedMotion } from "framer-motion";
import type { Project, Divergence } from "../types";
import { useAppSettings } from "../hooks/useAppSettings";
import { loadProjectSettings } from "../lib/projectSettings";
import { FAST_EASE_OUT, OVERLAY_FADE, SOFT_SPRING, getPopVariants } from "../lib/motion";

interface CreateDivergenceModalProps {
  project: Project;
  onClose: () => void;
  onCreated: (divergence: Divergence) => void;
}

function CreateDivergenceModal({ project, onClose, onCreated }: CreateDivergenceModalProps) {
  const { settings: appSettings } = useAppSettings();
  const [branchName, setBranchName] = useState("");
  const [useExistingBranch, setUseExistingBranch] = useState(false);
  const [remoteBranches, setRemoteBranches] = useState<string[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shouldReduceMotion = useReducedMotion();
  const panelVariants = useMemo(
    () => getPopVariants(shouldReduceMotion),
    [shouldReduceMotion]
  );
  const panelTransition = shouldReduceMotion ? FAST_EASE_OUT : SOFT_SPRING;

  const loadRemoteBranches = useCallback(async () => {
    if (loadingBranches) return;
    setLoadingBranches(true);
    try {
      const branches = await invoke<string[]>("list_remote_branches", {
        path: project.path,
      });
      setRemoteBranches(branches);
    } catch (err) {
      console.warn("Failed to load remote branches:", err);
    } finally {
      setLoadingBranches(false);
    }
  }, [loadingBranches, project.path]);

  const handleCreate = useCallback(async () => {
    if (!branchName.trim()) {
      setError("Branch name is required");
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const settings = await loadProjectSettings(project.id);

      // Create divergence via Tauri command (handles git clone/checkout)
      const divergence = await invoke<Divergence>("create_divergence", {
        projectId: project.id,
        projectName: project.name,
        projectPath: project.path,
        branchName: branchName.trim(),
        copyIgnoredSkip: settings.copyIgnoredSkip,
        useExistingBranch,
        divergenceMode: appSettings.divergenceMode,
      });

      // Save to database
      const db = await Database.load("sqlite:divergence.db");
      const divergenceMode = divergence.mode ?? appSettings.divergenceMode;
      await db.execute(
        "INSERT INTO divergences (project_id, name, branch, path, created_at, has_diverged, mode) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          divergence.project_id,
          divergence.name,
          divergence.branch,
          divergence.path,
          divergence.created_at,
          divergence.has_diverged ?? 0,
          divergenceMode,
        ]
      );

      // Get the ID of the inserted row so we can open it immediately
      const rows = await db.select<{ id: number }[]>("SELECT last_insert_rowid() as id");
      const insertedId = rows[0]?.id ?? 0;

      onCreated({ ...divergence, id: insertedId, mode: divergenceMode });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsCreating(false);
    }
  }, [branchName, project, onCreated, onClose, useExistingBranch, appSettings.divergenceMode]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isCreating) {
      handleCreate();
    }
    if (e.key === "Escape") {
      onClose();
    }
  }, [handleCreate, isCreating, onClose]);

  return (
    <motion.div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
      variants={OVERLAY_FADE}
      initial="hidden"
      animate="visible"
      exit="exit"
      transition={FAST_EASE_OUT}
    >
      <motion.div
        className="bg-sidebar border border-surface rounded-lg shadow-xl w-96 p-4"
        onClick={(e) => e.stopPropagation()}
        variants={panelVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        transition={panelTransition}
      >
        <h2 className="text-lg font-semibold text-text mb-4">Create Divergence</h2>

        <div className="mb-4">
          <label className="block text-sm text-subtext mb-1">Project</label>
          <div className="text-text">{project.name}</div>
          <div className="text-xs text-subtext truncate">{project.path}</div>
        </div>

        <div className="mb-4">
          <label className="block text-sm text-subtext mb-1">Branch Name</label>
          <input
            type="text"
            value={branchName}
            onChange={(e) => setBranchName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="feature/my-feature"
            list={useExistingBranch ? "remote-branches" : undefined}
            className="w-full px-3 py-2 bg-main border border-surface rounded text-text placeholder-subtext focus:outline-none focus:border-accent"
            autoFocus
            disabled={isCreating}
          />
          {useExistingBranch && (
            <datalist id="remote-branches">
              {remoteBranches.map((branch) => (
                <option value={branch} key={branch} />
              ))}
            </datalist>
          )}
        </div>

        <div className="mb-4 flex items-start gap-3">
          <input
            type="checkbox"
            checked={useExistingBranch}
            onChange={(e) => {
              const next = e.target.checked;
              setUseExistingBranch(next);
              if (next && remoteBranches.length === 0) {
                loadRemoteBranches();
              }
            }}
            className="mt-1 accent-accent"
            disabled={isCreating}
          />
          <div>
            <p className="text-sm text-text">Use existing branch from origin</p>
            <p className="text-xs text-subtext">
              When enabled, Divergence checks out the remote branch instead of creating a new one.
            </p>
            {useExistingBranch && loadingBranches && (
              <p className="text-xs text-subtext mt-1">Loading remote branches…</p>
            )}
          </div>
        </div>

        {isCreating && (
          <div className="mb-4">
            <div className="text-xs text-subtext mb-2">Creating divergence…</div>
            <div className="h-2 bg-surface rounded-full overflow-hidden">
              <div className="h-full w-1/3 bg-accent progress-indeterminate" />
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 px-3 py-2 bg-red/10 border border-red/30 rounded text-red text-sm">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-subtext hover:text-text"
            disabled={isCreating}
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={isCreating || !branchName.trim()}
            className="px-4 py-2 bg-accent text-main text-sm rounded hover:bg-accent/80 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCreating ? "Creating..." : "Create"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default CreateDivergenceModal;
