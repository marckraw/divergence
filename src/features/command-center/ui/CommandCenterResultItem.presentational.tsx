import type { Divergence, WorkspaceSession, Workspace, WorkspaceDivergence } from "../../../entities";
import { isAgentSession } from "../../../entities";
import type { CommandCenterSearchResult, CreateAction, FileResult } from "./CommandCenter.types";

interface CommandCenterResultItemProps {
  result: CommandCenterSearchResult;
  isSelected: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
}

function CommandCenterResultItem({
  result,
  isSelected,
  onClick,
  onMouseEnter,
}: CommandCenterResultItemProps) {
  return (
    <div
      data-result-item
      className={`flex items-center gap-3 px-3 py-2 rounded cursor-pointer transition-colors ${
        isSelected ? "bg-surface" : "hover:bg-surface/50"
      }`}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
    >
      <ResultIcon result={result} />
      <ResultContent result={result} />
      <ResultBadge result={result} />
    </div>
  );
}

function ResultIcon({ result }: { result: CommandCenterSearchResult }) {
  if (result.type === "file") {
    return (
      <svg className="w-4 h-4 text-subtext flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    );
  }

  if (result.type === "create_action") {
    return (
      <svg className="w-5 h-5 text-green flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
    );
  }

  if (result.type === "divergence" || result.type === "workspace_divergence") {
    return (
      <svg className="w-5 h-5 text-accent flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    );
  }

  if (result.type === "session") {
    const session = result.item as WorkspaceSession;
    if (isAgentSession(session)) {
      return (
        <svg className="w-5 h-5 text-accent flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 3h6m4 4v10a2 2 0 01-2 2H7a2 2 0 01-2-2V7m3 0V5a2 2 0 012-2h4a2 2 0 012 2v2M9 11h6M9 15h4" />
        </svg>
      );
    }
    return (
      <svg className="w-5 h-5 text-yellow flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    );
  }

  if (result.type === "workspace") {
    return (
      <svg className="w-5 h-5 text-blue flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    );
  }

  // project
  return (
    <svg className="w-5 h-5 text-text flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  );
}

function ResultContent({ result }: { result: CommandCenterSearchResult }) {
  if (result.type === "file") {
    const file = result.item as FileResult;
    return (
      <div className="flex-1 min-w-0">
        <div className="text-text truncate font-medium text-sm">{file.fileName}</div>
        {file.directory && (
          <div className="text-xs text-subtext truncate">{file.directory}</div>
        )}
      </div>
    );
  }

  if (result.type === "create_action") {
    const action = result.item as CreateAction;
    return (
      <div className="flex-1 min-w-0">
        <div className="text-text truncate">{action.label}</div>
        <div className="text-xs text-subtext truncate">{action.description}</div>
      </div>
    );
  }

  if (result.type === "session") {
    const session = result.item as WorkspaceSession;
    const agent = isAgentSession(session) ? session : null;
    return (
      <div className="flex-1 min-w-0">
        <div className="text-text truncate">{session.name}</div>
        {result.projectName && (
          <div className="text-xs text-subtext truncate">
            {result.projectName}{result.workspaceName ? ` - ${result.workspaceName}` : ""}
          </div>
        )}
        {agent && (
          <div className="text-xs text-subtext truncate">
            {agent.provider} &bull; {agent.model}
          </div>
        )}
      </div>
    );
  }

  if (result.type === "divergence") {
    const divergence = result.item as Divergence;
    return (
      <div className="flex-1 min-w-0">
        <div className="text-text truncate">{divergence.branch}</div>
        {result.projectName && (
          <div className="text-xs text-subtext truncate">{result.projectName}</div>
        )}
      </div>
    );
  }

  if (result.type === "workspace") {
    const workspace = result.item as Workspace;
    return (
      <div className="flex-1 min-w-0">
        <div className="text-text truncate">{workspace.name}</div>
        <div className="text-xs text-subtext truncate">{workspace.slug}</div>
      </div>
    );
  }

  if (result.type === "workspace_divergence") {
    const wd = result.item as WorkspaceDivergence;
    return (
      <div className="flex-1 min-w-0">
        <div className="text-text truncate">{wd.branch}</div>
        {result.workspaceName && (
          <div className="text-xs text-subtext truncate">{result.workspaceName}</div>
        )}
      </div>
    );
  }

  // project
  return (
    <div className="flex-1 min-w-0">
      <div className="text-text truncate">{(result.item as { name: string }).name}</div>
    </div>
  );
}

function ResultBadge({ result }: { result: CommandCenterSearchResult }) {
  if (result.type === "file") {
    const file = result.item as FileResult;
    if (!file.extension) return null;
    return (
      <span className="text-xs px-1.5 py-0.5 rounded bg-surface text-subtext flex-shrink-0">
        {file.extension}
      </span>
    );
  }

  if (result.type === "create_action") {
    return (
      <span className="text-xs px-2 py-0.5 rounded bg-green/20 text-green flex-shrink-0">
        create
      </span>
    );
  }

  if (result.type === "session") {
    const session = result.item as WorkspaceSession;
    if (isAgentSession(session)) {
      return (
        <span className="text-xs px-2 py-0.5 rounded bg-surface text-text flex-shrink-0">
          {session.provider} agent
        </span>
      );
    }
    return (
      <span className="text-xs px-2 py-0.5 rounded bg-yellow/20 text-yellow flex-shrink-0">
        terminal
      </span>
    );
  }

  const badgeConfig: Record<string, { bg: string; text: string; label: string }> = {
    divergence: { bg: "bg-accent/20", text: "text-accent", label: "divergence" },
    workspace: { bg: "bg-blue/20", text: "text-blue", label: "workspace" },
    workspace_divergence: { bg: "bg-accent/20", text: "text-accent", label: "ws divergence" },
    project: { bg: "bg-surface", text: "text-subtext", label: "project" },
  };

  const config = badgeConfig[result.type];
  if (!config) return null;

  return (
    <span className={`text-xs px-2 py-0.5 rounded ${config.bg} ${config.text} flex-shrink-0`}>
      {config.label}
    </span>
  );
}

export default CommandCenterResultItem;
