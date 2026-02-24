import { useCallback, useEffect, useMemo, useState } from "react";
import type { Project } from "../../../entities";
import {
  DEFAULT_COPY_IGNORED_SKIP,
  DEFAULT_USE_TMUX,
} from "../../../entities/project";
import { Button, ErrorBanner, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, TextInput, Textarea, normalizeTmuxHistoryLimit } from "../../../shared";
import type { ProjectSettings } from "../../../entities/project";
import { useProjectSettings } from "../../../entities/project";
import { useRalphyConfig } from "../../../shared";
import {
  getAdapterLabels,
  useProjectPortAllocations,
  detectFrameworkForPath,
} from "../../../entities/port-management";
import {
  formatProviderLabel,
  formatRalphyClaudeSummary,
  formatRalphyGithubSummary,
  formatRalphyLabelsSummary,
  formatRalphyProjectSummary,
  parseSkipListInput,
} from "../lib/projectSettingsPanel.pure";
import ProjectSettingsPanelPresentational from "./ProjectSettingsPanel.presentational";

interface ProjectSettingsPanelProps {
  project: Project | null;
  globalTmuxHistoryLimit: number;
  onSaved?: (settings: ProjectSettings) => void;
  contextPath?: string | null;
  contextLabel?: string;
}

function ProjectSettingsPanel({
  project,
  globalTmuxHistoryLimit,
  onSaved,
  contextPath,
  contextLabel = "Project",
}: ProjectSettingsPanelProps) {
  const projectId = project?.id ?? null;
  const { settings, loading, error, save } = useProjectSettings(projectId);
  const { data: ralphyConfig, loading: ralphyLoading, error: ralphyError } = useRalphyConfig(
    project?.path ?? null
  );
  const [draftSkipList, setDraftSkipList] = useState("");
  const [useTmux, setUseTmux] = useState(true);
  const [useCustomHistoryLimit, setUseCustomHistoryLimit] = useState(false);
  const [tmuxHistoryLimit, setTmuxHistoryLimit] = useState(globalTmuxHistoryLimit);
  const [isSaving, setIsSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [defaultPort, setDefaultPort] = useState<string>("");
  const [framework, setFramework] = useState<string>("");
  const [isDetecting, setIsDetecting] = useState(false);
  const { allocations: projectPortAllocations } = useProjectPortAllocations(projectId);
  const frameworkOptions = useMemo(() => getAdapterLabels(), []);

  const defaultListText = useMemo(() => DEFAULT_COPY_IGNORED_SKIP.join("\n"), []);

  useEffect(() => {
    if (!settings) {
      setDraftSkipList(defaultListText);
      setUseTmux(DEFAULT_USE_TMUX);
      setUseCustomHistoryLimit(false);
      setTmuxHistoryLimit(globalTmuxHistoryLimit);
      setDefaultPort("");
      setFramework("");
      return;
    }
    setDraftSkipList(settings.copyIgnoredSkip.join("\n"));
    setUseTmux(settings.useTmux);
    setUseCustomHistoryLimit(settings.tmuxHistoryLimit !== null);
    setTmuxHistoryLimit(settings.tmuxHistoryLimit ?? globalTmuxHistoryLimit);
    setDefaultPort(settings.defaultPort ? String(settings.defaultPort) : "");
    setFramework(settings.framework ?? "");
  }, [settings, defaultListText, globalTmuxHistoryLimit]);

  const ralphySummary = ralphyConfig?.status === "ok" ? ralphyConfig.summary : null;
  const ralphyProject = ralphySummary ? formatRalphyProjectSummary(ralphySummary) : "";
  const ralphyLabels = ralphySummary ? formatRalphyLabelsSummary(ralphySummary) : "";
  const ralphyClaude = ralphySummary ? formatRalphyClaudeSummary(ralphySummary) : "";
  const ralphyGithub = ralphySummary ? formatRalphyGithubSummary(ralphySummary) : "";

  const handleSave = async () => {
    if (!projectId) return;
    setIsSaving(true);
    try {
      const historyLimit = useCustomHistoryLimit
        ? normalizeTmuxHistoryLimit(tmuxHistoryLimit, globalTmuxHistoryLimit)
        : null;
      const parsedPort = defaultPort ? parseInt(defaultPort, 10) : null;
      const validPort = parsedPort && !isNaN(parsedPort) && parsedPort > 0 ? parsedPort : null;
      const saved = await save(
        parseSkipListInput(draftSkipList),
        useTmux,
        true,
        historyLimit,
        validPort,
        framework || null,
      );
      if (saved) {
        onSaved?.(saved);
      }
      setSavedAt(new Date().toLocaleTimeString());
    } finally {
      setIsSaving(false);
    }
  };

  const handleAutoDetectFramework = useCallback(async () => {
    if (!project) return;
    setIsDetecting(true);
    try {
      const adapter = await detectFrameworkForPath(project.path);
      if (adapter) {
        setFramework(adapter.id);
        if (!defaultPort) {
          setDefaultPort(String(adapter.defaultPort));
        }
      }
    } finally {
      setIsDetecting(false);
    }
  }, [project, defaultPort]);

  const handleReset = () => {
    setDraftSkipList(defaultListText);
  };

  if (!project) {
    return (
      <ProjectSettingsPanelPresentational>
        <div className="h-full p-4 text-sm text-subtext">
          Select a project to see its settings.
        </div>
      </ProjectSettingsPanelPresentational>
    );
  }

  const showContextPath = contextPath && contextPath !== project.path;

  return (
    <ProjectSettingsPanelPresentational>
      <div className="h-full flex flex-col">
      <div className="p-4 border-b border-surface">
        <h2 className="text-sm font-semibold text-text">Project Settings</h2>
        <p className="text-xs text-subtext mt-1">{project.name}</p>
        <p className="text-xs text-subtext/70 truncate">{project.path}</p>
        {showContextPath && (
          <p className="text-[11px] text-subtext/70 mt-1 truncate">
            {contextLabel} path: {contextPath}
          </p>
        )}
        {contextLabel === "Divergence" && (
          <p className="text-[11px] text-subtext/70 mt-1">
            These settings apply to the parent project and its divergences.
          </p>
        )}
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
              className="accent-primary"
            />
            Use tmux
          </label>
        </div>
        <div className="flex items-start justify-between gap-3 bg-main/50 border border-surface rounded p-3">
          <div>
            <p className="text-sm text-text">tmux History Limit</p>
            <p className="text-xs text-subtext/80 mt-1">
              Lines kept in tmux scrollback for this project.
            </p>
            <p className="text-xs text-subtext/60 mt-1">
              Global default: {globalTmuxHistoryLimit.toLocaleString()} lines.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2 text-xs text-subtext">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={useCustomHistoryLimit}
                onChange={(e) => setUseCustomHistoryLimit(e.target.checked)}
                disabled={loading}
                className="accent-primary"
              />
              Override
            </label>
            <TextInput
              type="number"
              min={1000}
              max={500000}
              value={tmuxHistoryLimit}
              onChange={(e) => setTmuxHistoryLimit(Number(e.target.value))}
              disabled={loading || !useCustomHistoryLimit}
              className="w-24 px-2 py-1 text-right"
            />
          </div>
        </div>
        <div className="bg-main/50 border border-surface rounded p-3">
          <p className="text-sm text-text">Ralphy</p>
          <p className="text-xs text-subtext/80 mt-1">
            Looks for <span className="font-mono">.ralphy/config.json</span> in this project.
          </p>

          {ralphyLoading && (
            <p className="text-xs text-subtext mt-2">Checking configuration...</p>
          )}

          {!ralphyLoading && ralphyError && (
            <p className="text-xs text-red mt-2">
              Failed to load Ralphy configuration: {ralphyError}
            </p>
          )}

          {!ralphyLoading && !ralphyError && ralphyConfig?.status === "missing" && (
            <>
              <p className="text-xs text-subtext mt-2">No Ralphy config found.</p>
              <p className="text-xs text-subtext/70 mt-1">
                Run <span className="font-mono">ralphy init</span> in the project root to create one.
              </p>
            </>
          )}

          {!ralphyLoading && !ralphyError && ralphyConfig?.status === "invalid" && (
            <>
              <p className="text-xs text-red mt-2">Ralphy config found but could not be parsed.</p>
              <p className="text-xs text-subtext/70 mt-1 truncate">{ralphyConfig.path}</p>
              <p className="text-xs text-subtext/70 mt-1">{ralphyConfig.error}</p>
            </>
          )}

          {!ralphyLoading && !ralphyError && ralphySummary && (
            <div className="mt-2 space-y-1 text-xs text-subtext">
              <div>
                Configured:{" "}
                <span className="text-text">
                  Yes{ralphySummary.version ? ` (v${ralphySummary.version})` : ""}
                </span>
              </div>
              <div>
                Provider: <span className="text-text">{formatProviderLabel(ralphySummary.provider_type)}</span>
              </div>
              {ralphyProject && (
                <div>
                  Project: <span className="text-text">{ralphyProject}</span>
                </div>
              )}
              {ralphyLabels && (
                <div>
                  Labels: <span className="text-text">{ralphyLabels}</span>
                </div>
              )}
              {ralphyClaude && (
                <div>
                  Claude: <span className="text-text">{ralphyClaude}</span>
                </div>
              )}
              {ralphyGithub && (
                <div>
                  GitHub: <span className="text-text">{ralphyGithub}</span>
                </div>
              )}
            </div>
          )}
        </div>
        {/* Port Management */}
        <div className="bg-main/50 border border-surface rounded p-3">
          <p className="text-sm text-text">Port Management</p>
          <p className="text-xs text-subtext/80 mt-1">
            Configure how dev server ports are assigned for divergences.
          </p>

          <div className="mt-3 space-y-3">
            <div className="flex items-center gap-3">
              <label className="text-xs text-subtext w-20 shrink-0">Framework</label>
              <Select value={framework || "__none__"} onValueChange={(val) => setFramework(val === "__none__" ? "" : val)} disabled={loading}>
                <SelectTrigger className="flex-1 text-xs h-7">
                  <SelectValue placeholder="Auto-detect" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Auto-detect</SelectItem>
                  {frameworkOptions.map((opt) => (
                    <SelectItem key={opt.id} value={opt.id}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                onClick={() => { void handleAutoDetectFramework(); }}
                disabled={loading || isDetecting}
                variant="secondary"
                size="xs"
                className="px-2 py-1 text-[10px] rounded border border-surface text-subtext hover:text-text hover:bg-surface disabled:opacity-40"
              >
                {isDetecting ? "Detecting..." : "Detect"}
              </Button>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-xs text-subtext w-20 shrink-0">Default Port</label>
              <TextInput
                type="number"
                min={1024}
                max={65535}
                placeholder="Auto (3100+)"
                value={defaultPort}
                onChange={(e) => setDefaultPort(e.target.value)}
                disabled={loading}
                className="flex-1 px-2 py-1 text-xs"
              />
            </div>
          </div>

          {projectPortAllocations.length > 0 && (
            <div className="mt-3 border-t border-surface/50 pt-2">
              <p className="text-[10px] uppercase text-subtext mb-1">Active Allocations</p>
              <div className="space-y-1">
                {projectPortAllocations.map((alloc) => (
                  <div key={alloc.id} className="flex items-center justify-between text-xs">
                    <span className="text-subtext">
                      {alloc.entityType} #{alloc.entityId}
                    </span>
                    <span className="font-mono text-accent">:{alloc.port}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs uppercase text-subtext mb-2">
            Ignored Copy Skip List
          </label>
          <p className="text-xs text-subtext/80 mb-2">
            These ignored paths will not be copied into new divergences. Enter one entry per line.
          </p>
          <Textarea
            className="min-h-[160px]"
            value={draftSkipList}
            onChange={(e) => setDraftSkipList(e.target.value)}
            placeholder={defaultListText}
            disabled={loading}
          />
        </div>

        {error && (
          <ErrorBanner className="px-2 py-1">{error}</ErrorBanner>
        )}
      </div>

      <div className="p-4 border-t border-surface flex items-center justify-between gap-2">
        <Button
          onClick={handleReset}
          variant="ghost"
          size="xs"
          className="text-xs text-subtext hover:text-text"
          disabled={loading || isSaving}
        >
          Reset to default
        </Button>
        <div className="flex items-center gap-2">
          {savedAt && (
            <span className="text-xs text-subtext/70">Saved {savedAt}</span>
          )}
          <Button
            onClick={handleSave}
            variant="primary"
            size="sm"
            className="px-3 py-1.5 bg-primary text-primary-foreground text-xs rounded hover:bg-primary/80 disabled:opacity-60"
            disabled={loading || isSaving}
          >
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
      </div>
    </ProjectSettingsPanelPresentational>
  );
}

export default ProjectSettingsPanel;
