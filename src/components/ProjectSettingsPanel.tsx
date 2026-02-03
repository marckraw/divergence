import { useEffect, useMemo, useState } from "react";
import type { Project } from "../types";
import { DEFAULT_COPY_IGNORED_SKIP, DEFAULT_USE_TMUX, DEFAULT_USE_WEBGL } from "../lib/projectSettings";
import type { ProjectSettings } from "../lib/projectSettings";
import { useProjectSettings } from "../hooks/useProjectSettings";

interface ProjectSettingsPanelProps {
  project: Project | null;
  onSaved?: (settings: ProjectSettings) => void;
}

function ProjectSettingsPanel({ project, onSaved }: ProjectSettingsPanelProps) {
  const projectId = project?.id ?? null;
  const { settings, loading, error, save } = useProjectSettings(projectId);
  const [draftSkipList, setDraftSkipList] = useState("");
  const [useTmux, setUseTmux] = useState(true);
  const [useWebgl, setUseWebgl] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const defaultListText = useMemo(() => DEFAULT_COPY_IGNORED_SKIP.join("\n"), []);

  useEffect(() => {
    if (!settings) {
      setDraftSkipList(defaultListText);
      setUseTmux(DEFAULT_USE_TMUX);
      setUseWebgl(DEFAULT_USE_WEBGL);
      return;
    }
    setDraftSkipList(settings.copyIgnoredSkip.join("\n"));
    setUseTmux(settings.useTmux);
    setUseWebgl(settings.useWebgl);
  }, [settings, defaultListText]);

  const parseList = (value: string) =>
    value
      .split("\n")
      .map(line => line.trim())
      .filter(Boolean);

  const handleSave = async () => {
    if (!projectId) return;
    setIsSaving(true);
    try {
      const saved = await save(parseList(draftSkipList), useTmux, useWebgl);
      if (saved) {
        onSaved?.(saved);
      }
      setSavedAt(new Date().toLocaleTimeString());
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setDraftSkipList(defaultListText);
  };

  if (!project) {
    return (
      <div className="h-full p-4 text-sm text-subtext">
        Select a project to see its settings.
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-surface">
        <h2 className="text-sm font-semibold text-text">Project Settings</h2>
        <p className="text-xs text-subtext mt-1">{project.name}</p>
        <p className="text-xs text-subtext/70 truncate">{project.path}</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="flex items-start justify-between gap-3 bg-main/50 border border-surface rounded p-3">
          <div>
            <p className="text-sm text-text">Persistent Terminal Sessions</p>
            <p className="text-xs text-subtext/80 mt-1">
              Use tmux so running commands keep going after the app closes.
            </p>
            <p className="text-xs text-subtext/60 mt-1">
              If tmux isn’t installed, the terminal will fall back to a normal shell.
            </p>
          </div>
          <label className="flex items-center gap-2 text-xs text-subtext">
            <input
              type="checkbox"
              checked={useTmux}
              onChange={(e) => setUseTmux(e.target.checked)}
              disabled={loading}
              className="accent-accent"
            />
            Use tmux
          </label>
        </div>
        <div className="flex items-start justify-between gap-3 bg-main/50 border border-surface rounded p-3">
          <div>
            <p className="text-sm text-text">WebGL Renderer</p>
            <p className="text-xs text-subtext/80 mt-1">
              Faster rendering; falls back to Canvas if unavailable.
            </p>
          </div>
          <label className="flex items-center gap-2 text-xs text-subtext">
            <input
              type="checkbox"
              checked={useWebgl}
              onChange={(e) => setUseWebgl(e.target.checked)}
              disabled={loading}
              className="accent-accent"
            />
            Use WebGL
          </label>
        </div>
        <div>
          <label className="block text-xs uppercase text-subtext mb-2">
            Ignored Copy Skip List
          </label>
          <p className="text-xs text-subtext/80 mb-2">
            These ignored paths will not be copied into new divergences. Enter one entry per line.
          </p>
          <textarea
            className="w-full min-h-[160px] bg-main border border-surface rounded p-2 text-sm text-text focus:outline-none focus:border-accent"
            value={draftSkipList}
            onChange={(e) => setDraftSkipList(e.target.value)}
            placeholder={defaultListText}
            disabled={loading}
          />
        </div>

        {error && (
          <div className="text-xs text-red bg-red/10 border border-red/30 rounded px-2 py-1">
            {error}
          </div>
        )}
      </div>

      <div className="p-4 border-t border-surface flex items-center justify-between gap-2">
        <button
          onClick={handleReset}
          className="text-xs text-subtext hover:text-text"
          disabled={loading || isSaving}
        >
          Reset to default
        </button>
        <div className="flex items-center gap-2">
          {savedAt && (
            <span className="text-xs text-subtext/70">Saved {savedAt}</span>
          )}
          <button
            onClick={handleSave}
            className="px-3 py-1.5 bg-accent text-main text-xs rounded hover:bg-accent/80 disabled:opacity-60"
            disabled={loading || isSaving}
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ProjectSettingsPanel;
