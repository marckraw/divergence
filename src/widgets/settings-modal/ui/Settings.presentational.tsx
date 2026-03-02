import {
  Button,
  IconButton,
  Kbd,
  ModalFooter,
  ModalShell,
  ProgressBar,
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
    description: "Command templates and auth",
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
                  <div>
                    <label className="block text-sm font-medium text-text mb-2">Claude Command Template</label>
                    <Textarea
                      value={settings.agentCommandClaude}
                      onChange={(event) => onUpdateSetting("agentCommandClaude", event.target.value)}
                      className="min-h-[110px]"
                    />
                    <p className="text-xs text-subtext mt-1">Supports <code>{"{workspacePath}"}</code> and <code>{"{briefPath}"}</code>.</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text mb-2">Codex Command Template</label>
                    <Textarea
                      value={settings.agentCommandCodex}
                      onChange={(event) => onUpdateSetting("agentCommandCodex", event.target.value)}
                      className="min-h-[110px]"
                    />
                    <p className="text-xs text-subtext mt-1">Supports <code>{"{workspacePath}"}</code> and <code>{"{briefPath}"}</code>.</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text mb-2">Claude OAuth Token (Automations)</label>
                    <div className="relative">
                      <TextInput
                        type={oauthTokenVisible ? "text" : "password"}
                        value={settings.claudeOAuthToken}
                        onChange={(event) => onUpdateSetting("claudeOAuthToken", event.target.value)}
                        className="pr-10"
                        placeholder="Paste token from claude setup-token"
                      />
                      <IconButton
                        type="button"
                        onClick={onToggleOAuthTokenVisible}
                        className="absolute right-2 top-1/2 -translate-y-1/2"
                        variant="ghost"
                        size="xs"
                        label={oauthTokenVisible ? "Hide token" : "Show token"}
                        icon={oauthTokenVisible ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-5 0-9.27-3.11-11-7.5a11.72 11.72 0 013.168-4.477M6.343 6.343A9.97 9.97 0 0112 5c5 0 9.27 3.11 11 7.5a11.72 11.72 0 01-4.168 4.477M6.343 6.343L3 3m3.343 3.343l2.829 2.829m4.486 4.486l2.829 2.829M3 3l18 18m-9-5.5a2.5 2.5 0 01-2.45-3" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        )}
                      />
                    </div>
                  </div>
                </>
              )}

              {activeCategory === "integrations" && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-text mb-2">GitHub Token</label>
                    <div className="relative">
                      <TextInput
                        type={githubTokenVisible ? "text" : "password"}
                        value={settings.githubToken}
                        onChange={(event) => onUpdateSetting("githubToken", event.target.value)}
                        className="pr-10"
                        placeholder="ghp_..."
                      />
                      <IconButton
                        type="button"
                        onClick={onToggleGithubTokenVisible}
                        className="absolute right-2 top-1/2 -translate-y-1/2"
                        variant="ghost"
                        size="xs"
                        label={githubTokenVisible ? "Hide token" : "Show token"}
                        icon={githubTokenVisible ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-5 0-9.27-3.11-11-7.5a11.72 11.72 0 013.168-4.477M6.343 6.343A9.97 9.97 0 0112 5c5 0 9.27 3.11 11 7.5a11.72 11.72 0 01-4.168 4.477M6.343 6.343L3 3m3.343 3.343l2.829 2.829m4.486 4.486l2.829 2.829M3 3l18 18m-9-5.5a2.5 2.5 0 01-2.45-3" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        )}
                      />
                    </div>
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
                    <div className="relative">
                      <TextInput
                        type={linearTokenVisible ? "text" : "password"}
                        value={settings.linearApiToken}
                        onChange={(event) => onUpdateSetting("linearApiToken", event.target.value)}
                        className="pr-10"
                        placeholder="lin_api_..."
                      />
                      <IconButton
                        type="button"
                        onClick={onToggleLinearTokenVisible}
                        className="absolute right-2 top-1/2 -translate-y-1/2"
                        variant="ghost"
                        size="xs"
                        label={linearTokenVisible ? "Hide token" : "Show token"}
                        icon={linearTokenVisible ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-5 0-9.27-3.11-11-7.5a11.72 11.72 0 013.168-4.477M6.343 6.343A9.97 9.97 0 0112 5c5 0 9.27 3.11 11 7.5a11.72 11.72 0 01-4.168 4.477M6.343 6.343L3 3m3.343 3.343l2.829 2.829m4.486 4.486l2.829 2.829M3 3l18 18m-9-5.5a2.5 2.5 0 01-2.45-3" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        )}
                      />
                    </div>
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
                    <div className="relative">
                      <TextInput
                        type={cloudTokenVisible ? "text" : "password"}
                        value={settings.cloudApiToken}
                        onChange={(event) => onUpdateSetting("cloudApiToken", event.target.value)}
                        className="pr-10"
                        placeholder="Cloud auth token"
                      />
                      <IconButton
                        type="button"
                        onClick={onToggleCloudTokenVisible}
                        className="absolute right-2 top-1/2 -translate-y-1/2"
                        variant="ghost"
                        size="xs"
                        label={cloudTokenVisible ? "Hide token" : "Show token"}
                        icon={cloudTokenVisible ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-5 0-9.27-3.11-11-7.5a11.72 11.72 0 013.168-4.477M6.343 6.343A9.97 9.97 0 0112 5c5 0 9.27 3.11 11 7.5a11.72 11.72 0 01-4.168 4.477M6.343 6.343L3 3m3.343 3.343l2.829 2.829m4.486 4.486l2.829 2.829M3 3l18 18m-9-5.5a2.5 2.5 0 01-2.45-3" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        )}
                      />
                    </div>
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
