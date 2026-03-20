import {
  Button,
  Kbd,
  ModalFooter,
  ModalShell,
  IconButton,
  ProgressBar,
  SecretTokenField,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  TextInput,
  Textarea,
} from "../../../shared";
import { RemoteAccessSettings } from "../../../features/remote-access";
import type {
  SettingsCategoryId,
  SettingsPresentationalProps,
} from "./Settings.types";

interface SettingsCategoryItem {
  id: SettingsCategoryId;
  label: string;
  description: string;
}

const SETTINGS_CATEGORIES: SettingsCategoryItem[] = [
  {
    id: "general",
    label: "General",
    description: "Shell, storage, terminal behavior",
  },
  {
    id: "appearance",
    label: "Appearance",
    description: "App light/dark mode",
  },
  {
    id: "agents",
    label: "Agents",
    description: "Providers, auth, and compatibility",
  },
  {
    id: "integrations",
    label: "Integrations",
    description: "GitHub, Linear, and cloud relay",
  },
  {
    id: "remote-access",
    label: "Remote Access",
    description: "Mobile pairing and devices",
  },
  {
    id: "shortcuts",
    label: "Shortcuts",
    description: "Keyboard reference",
  },
  {
    id: "updates",
    label: "Updates & About",
    description: "Version and updater",
  },
];

function getProviderReadinessTone(status: "ready" | "partial" | "setup-required") {
  switch (status) {
    case "ready":
      return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
    case "setup-required":
      return "border-red/30 bg-red/10 text-red";
    case "partial":
    default:
      return "border-yellow/30 bg-yellow/10 text-yellow";
  }
}

function formatCustomModelList(models: string[] | undefined): string {
  return (models ?? []).join("\n");
}

function parseCustomModelList(value: string): string[] {
  const seen = new Set<string>();
  const next: string[] = [];

  value
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .forEach((entry) => {
      if (!entry || seen.has(entry)) {
        return;
      }
      seen.add(entry);
      next.push(entry);
    });

  return next;
}

function CategorySidebarButton({
  category,
  active,
  onSelect,
}: {
  category: SettingsCategoryItem;
  active: boolean;
  onSelect: (category: SettingsCategoryId) => void;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className={`w-full text-left h-auto px-3 py-2 rounded-md border ${
        active
          ? "border-accent bg-accent/10 text-text"
          : "border-transparent bg-transparent text-subtext hover:text-text hover:bg-main/60"
      }`}
      onClick={() => onSelect(category.id)}
    >
      <div>
        <div className="text-sm font-medium">{category.label}</div>
        <div className="text-xs opacity-80 mt-0.5">{category.description}</div>
      </div>
    </Button>
  );
}

function SettingsPresentational({
  loading,
  settings,
  agentRuntimeCapabilities,
  appVersion,
  updater,
  updaterPresentation,
  activeCategory,
  onCategoryChange,
  onClose,
  onSave,
  onUpdateSetting,
  oauthTokenVisible,
  githubTokenVisible,
  linearTokenVisible,
  cloudTokenVisible,
  onToggleOAuthTokenVisible,
  onToggleGithubTokenVisible,
  onToggleLinearTokenVisible,
  onToggleCloudTokenVisible,
  autoGenerateCode,
}: SettingsPresentationalProps) {
  if (loading) {
    return (
      <ModalShell
        closeOnOverlayClick={false}
        size="sm"
        surface="sidebar"
        panelClassName="p-8"
      >
        <p className="text-subtext">Loading settings...</p>
      </ModalShell>
    );
  }

  return (
    <ModalShell
      onRequestClose={onClose}
      size="xl"
      surface="sidebar"
      overlayClassName="p-4"
      panelClassName="w-[80vw] h-[80vh] max-w-none p-0 overflow-hidden"
    >
      <div className="h-full flex flex-col">
        <div className="h-14 px-4 border-b border-surface flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-text">Settings</h2>
            <p className="text-xs text-subtext">Application preferences and integrations</p>
          </div>
          <IconButton
            onClick={onClose}
            variant="subtle"
            size="sm"
            label="Close"
            icon={(
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            )}
          />
        </div>

        <div className="flex-1 min-h-0 flex overflow-hidden">
          <aside className="w-72 shrink-0 border-r border-surface p-3 bg-main/40 overflow-y-auto">
            <div className="space-y-2">
              {SETTINGS_CATEGORIES.map((category) => (
                <CategorySidebarButton
                  key={category.id}
                  category={category}
                  active={activeCategory === category.id}
                  onSelect={onCategoryChange}
                />
              ))}
            </div>
          </aside>

          <section className="flex-1 min-w-0 p-4 overflow-y-auto bg-sidebar">
            <div className="max-w-3xl space-y-5">
              {activeCategory === "general" && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-text mb-2">Default Shell</label>
                    <Select value={settings.defaultShell} onValueChange={(val) => onUpdateSetting("defaultShell", val)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="/bin/zsh">zsh</SelectItem>
                        <SelectItem value="/bin/bash">bash</SelectItem>
                        <SelectItem value="/bin/sh">sh</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-subtext mt-1">Shell used for new terminal sessions.</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text mb-2">Divergence Storage</label>
                    <div className="px-3 py-2 bg-main border border-surface rounded text-subtext text-sm">
                      {settings.divergenceBasePath}
                    </div>
                    <p className="text-xs text-subtext mt-1">Cloned repositories and workspace assets location.</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text mb-2">tmux History Limit</label>
                    <TextInput
                      type="number"
                      min={1000}
                      max={500000}
                      value={settings.tmuxHistoryLimit}
                      onChange={(event) => onUpdateSetting("tmuxHistoryLimit", Number(event.target.value))}
                      className="focus:ring-0"
                    />
                    <p className="text-xs text-subtext mt-1">Lines kept in tmux scrollback. Recommended: 50,000.</p>
                  </div>

                  <div>
                    <label className="inline-flex items-center gap-2 text-sm text-text">
                      <input
                        type="checkbox"
                        checked={settings.restoreTabsOnRestart}
                        onChange={(event) => onUpdateSetting("restoreTabsOnRestart", event.target.checked)}
                        className="accent-primary"
                      />
                      Restore open terminal tabs on restart
                    </label>
                    <p className="text-xs text-subtext mt-1">Reopen currently open tabs when Divergence launches.</p>
                  </div>
                </>
              )}

              {activeCategory === "appearance" && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-text mb-2">Application Theme</label>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => onUpdateSetting("theme", "dark")}
                        variant={settings.theme === "dark" ? "primary" : "subtle"}
                        size="md"
                        className="flex-1"
                      >
                        Dark
                      </Button>
                      <Button
                        onClick={() => onUpdateSetting("theme", "light")}
                        variant={settings.theme === "light" ? "primary" : "subtle"}
                        size="md"
                        className="flex-1"
                      >
                        Light
                      </Button>
                    </div>
                  </div>
                </>
              )}

              {activeCategory === "agents" && (
                <>
                  {agentRuntimeCapabilities && (
                    <div className="space-y-3">
                      <div>
                        <h3 className="text-sm font-medium text-text">Provider Runtime Readiness</h3>
                        <p className="mt-1 text-xs text-subtext">
                          Divergence uses the official local CLI/app-server for each provider. Subscription-backed login lives inside those CLIs.
                        </p>
                      </div>
                      <div className="grid gap-3">
                        {agentRuntimeCapabilities.providers.map((provider) => (
                          <div
                            key={provider.id}
                            className="rounded-xl border border-surface bg-main/50 p-3 space-y-2"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-text">{provider.label}</span>
                                  <span className="rounded-full border border-surface bg-surface px-1.5 py-0.5 text-[10px] uppercase tracking-[0.18em] text-subtext">
                                    {provider.transport}
                                  </span>
                                  <span className={`rounded-full border px-1.5 py-0.5 text-[10px] uppercase tracking-[0.18em] ${getProviderReadinessTone(provider.readiness.status)}`}>
                                    {provider.readiness.status}
                                  </span>
                                </div>
                                <p className="mt-1 text-xs text-subtext">{provider.readiness.summary}</p>
                              </div>
                              <div className="text-right">
                                <div className="text-[10px] uppercase tracking-[0.18em] text-subtext">Default model</div>
                                <div className="mt-1 text-xs text-text">{provider.defaultModel}</div>
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-2 text-[11px] text-subtext">
                              <span className="rounded-full bg-surface px-2 py-1">
                                Auth: {provider.readiness.authStatus}
                              </span>
                              <span className="rounded-full bg-surface px-2 py-1">
                                {provider.features.streaming ? "Streaming" : "Non-streaming"}
                              </span>
                              <span className="rounded-full bg-surface px-2 py-1">
                                {provider.features.resume ? "Resumable" : "Snapshot-only"}
                              </span>
                              <span className="rounded-full bg-surface px-2 py-1">
                                {provider.features.structuredRequests ? "Structured requests" : "No structured requests"}
                              </span>
                            </div>

                            <div className="space-y-1">
                              <div className="text-[11px] text-subtext">
                                CLI: <span className="text-text">{provider.readiness.detectedCommand ?? "not detected"}</span>
                              </div>
                              <div className="text-[11px] text-subtext">
                                Version: <span className="text-text">{provider.readiness.detectedVersion ?? "unknown"}</span>
                              </div>
                              <div className="text-[11px] text-subtext">
                                Candidates: <span className="text-text">{provider.readiness.binaryCandidates.join(", ")}</span>
                              </div>
                              {provider.readiness.details.length > 0 && (
                                <ul className="space-y-1 text-[11px] text-subtext">
                                  {provider.readiness.details.map((detail) => (
                                    <li key={detail}>• {detail}</li>
                                  ))}
                                </ul>
                              )}
                            </div>

                            <div className="space-y-2 rounded-lg border border-surface bg-sidebar/40 p-3">
                              <div>
                                <label className="block text-xs font-medium text-text">
                                  Custom model slugs
                                </label>
                                <p className="mt-1 text-[11px] text-subtext">
                                  One slug per line. These are merged after detected provider models.
                                </p>
                              </div>
                              <Textarea
                                value={formatCustomModelList(settings.customAgentModels[provider.id])}
                                onChange={(event) => {
                                  const parsedModels = parseCustomModelList(event.target.value);
                                  const nextCustomModels = { ...settings.customAgentModels };
                                  if (parsedModels.length === 0) {
                                    delete nextCustomModels[provider.id];
                                  } else {
                                    nextCustomModels[provider.id] = parsedModels;
                                  }
                                  onUpdateSetting("customAgentModels", nextCustomModels);
                                }}
                                placeholder="gpt-5.1\nclaude-opus-4.2"
                                className="min-h-[92px]"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-text mb-2">Claude Command Template</label>
                    <Textarea
                      value={settings.agentCommandClaude}
                      onChange={(event) => onUpdateSetting("agentCommandClaude", event.target.value)}
                      className="min-h-[110px]"
                    />
                    <p className="text-xs text-subtext mt-1">
                      Legacy/manual automation compatibility only. Supports <code>{"{workspacePath}"}</code> and <code>{"{briefPath}"}</code>.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text mb-2">Codex Command Template</label>
                    <Textarea
                      value={settings.agentCommandCodex}
                      onChange={(event) => onUpdateSetting("agentCommandCodex", event.target.value)}
                      className="min-h-[110px]"
                    />
                    <p className="text-xs text-subtext mt-1">
                      Legacy/manual automation compatibility only. Supports <code>{"{workspacePath}"}</code> and <code>{"{briefPath}"}</code>.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text mb-2">Claude OAuth Token (Automations)</label>
                    <SecretTokenField
                      value={settings.claudeOAuthToken}
                      onChange={(event) => onUpdateSetting("claudeOAuthToken", event.target.value)}
                      placeholder="Paste token from claude setup-token"
                      visible={oauthTokenVisible}
                      onToggleVisibility={onToggleOAuthTokenVisible}
                    />
                  </div>
                </>
              )}

              {activeCategory === "integrations" && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-text mb-2">GitHub Token</label>
                    <SecretTokenField
                      value={settings.githubToken}
                      onChange={(event) => onUpdateSetting("githubToken", event.target.value)}
                      placeholder="ghp_..."
                      visible={githubTokenVisible}
                      onToggleVisibility={onToggleGithubTokenVisible}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text mb-2">GitHub Webhook Secret</label>
                    <TextInput
                      type="password"
                      value={settings.githubWebhookSecret}
                      onChange={(event) => onUpdateSetting("githubWebhookSecret", event.target.value)}
                      placeholder="Webhook signing secret"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text mb-2">Linear API Token</label>
                    <SecretTokenField
                      value={settings.linearApiToken}
                      onChange={(event) => onUpdateSetting("linearApiToken", event.target.value)}
                      placeholder="lin_api_..."
                      visible={linearTokenVisible}
                      onToggleVisibility={onToggleLinearTokenVisible}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text mb-2">Cloud API Base URL</label>
                    <TextInput
                      type="text"
                      value={settings.cloudApiBaseUrl}
                      onChange={(event) => onUpdateSetting("cloudApiBaseUrl", event.target.value)}
                      placeholder="https://cloud.divergence.app"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text mb-2">Cloud API Token</label>
                    <SecretTokenField
                      value={settings.cloudApiToken}
                      onChange={(event) => onUpdateSetting("cloudApiToken", event.target.value)}
                      placeholder="Cloud auth token"
                      visible={cloudTokenVisible}
                      onToggleVisibility={onToggleCloudTokenVisible}
                    />
                  </div>
                </>
              )}

              {activeCategory === "remote-access" && (
                <RemoteAccessSettings autoGenerateCode={autoGenerateCode} />
              )}

              {activeCategory === "shortcuts" && (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between px-3 py-2 bg-main border border-surface rounded">
                    <span className="text-subtext">Toggle Sidebar</span>
                    <Kbd className="px-2">Cmd B</Kbd>
                  </div>
                  <div className="flex justify-between px-3 py-2 bg-main border border-surface rounded">
                    <span className="text-subtext">Toggle Right Panel</span>
                    <Kbd className="px-2">Cmd Shift B</Kbd>
                  </div>
                  <div className="flex justify-between px-3 py-2 bg-main border border-surface rounded">
                    <span className="text-subtext">Quick Switcher</span>
                    <Kbd className="px-2">Cmd K</Kbd>
                  </div>
                  <div className="flex justify-between px-3 py-2 bg-main border border-surface rounded">
                    <span className="text-subtext">Open Work Inbox</span>
                    <Kbd className="px-2">Cmd I</Kbd>
                  </div>
                  <div className="flex justify-between px-3 py-2 bg-main border border-surface rounded">
                    <span className="text-subtext">New Divergence</span>
                    <Kbd className="px-2">Cmd T</Kbd>
                  </div>
                  <div className="flex justify-between px-3 py-2 bg-main border border-surface rounded">
                    <span className="text-subtext">Close Terminal</span>
                    <Kbd className="px-2">Cmd W</Kbd>
                  </div>
                  <div className="flex justify-between px-3 py-2 bg-main border border-surface rounded">
                    <span className="text-subtext">Switch Tab</span>
                    <Kbd className="px-2">Cmd 1-9</Kbd>
                  </div>
                  <div className="flex justify-between px-3 py-2 bg-main border border-surface rounded">
                    <span className="text-subtext">Previous/Next Tab</span>
                    <Kbd className="px-2">Cmd [ / ]</Kbd>
                  </div>
                </div>
              )}

              {activeCategory === "updates" && (
                <div className="space-y-3">
                  {appVersion && (
                    <p className="text-sm text-subtext">
                      Current version: <span className="text-text font-medium">v{appVersion}</span>
                    </p>
                  )}

                  <p className="text-sm text-subtext">
                    <span className={updaterPresentation.isError ? "text-red-400" : undefined}>
                      {updaterPresentation.message}
                    </span>
                  </p>

                  {updaterPresentation.showProgress && (
                    <ProgressBar
                      value={updater.progress}
                      className="w-full"
                      barClassName="bg-accent"
                    />
                  )}

                  <div className="flex gap-2">
                    {updaterPresentation.showCheckButton && (
                      <Button
                        onClick={updater.checkForUpdate}
                        variant="secondary"
                        size="sm"
                      >
                        Check for Updates
                      </Button>
                    )}
                    {updaterPresentation.showInstallButton && (
                      <Button
                        onClick={updater.downloadAndInstall}
                        variant="primary"
                        size="sm"
                      >
                        Install and Restart
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>

        <ModalFooter className="px-4 py-3 border-t border-surface justify-end">
          <Button onClick={onClose} variant="ghost" size="md">
            Cancel
          </Button>
          <Button onClick={onSave} variant="primary" size="md">
            Save
          </Button>
        </ModalFooter>
      </div>
    </ModalShell>
  );
}

export default SettingsPresentational;
