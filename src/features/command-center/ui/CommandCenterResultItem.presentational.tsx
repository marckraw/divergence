import { motion, useReducedMotion } from "framer-motion";
import type { Divergence, StageTab, WorkspaceSession, Workspace, WorkspaceDivergence } from "../../../entities";
import { isAgentSession, isEditorSession } from "../../../entities";
import { FAST_EASE_OUT, getContentSwapVariants } from "../../../shared";
import type { CommandCenterSearchResult, CreateAction, FileResult } from "./CommandCenter.types";

interface CommandCenterResultItemProps {
  result: CommandCenterSearchResult;
  isSelected: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
}

function CommandCenterResultItem({ result, isSelected, onClick, onMouseEnter }: CommandCenterResultItemProps) {
  const shouldReduceMotion = useReducedMotion();
  const itemVariants = getContentSwapVariants(shouldReduceMotion);
  const itemTransition = shouldReduceMotion
    ? FAST_EASE_OUT
    : { type: "spring", stiffness: 300, damping: 32, mass: 0.8 };

  return (
    <motion.div
      layout={shouldReduceMotion ? undefined : "position"}
      variants={itemVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      transition={itemTransition}
      className={`flex items-center gap-3 px-3 py-2 rounded cursor-pointer transition-colors ${
        isSelected ? "bg-surface" : "hover:bg-surface/50"
      }`}
      data-result-item
      onClick={onClick}
      onMouseEnter={onMouseEnter}
    >
      <ResultIcon result={result} />
      <ResultContent result={result} />
      <ResultBadge result={result} />
    </motion.div>
  );
}

function ResultIcon({ result }: { result: CommandCenterSearchResult }) {
  const cls = "w-4 h-4 flex-shrink-0";

  if (result.type === "file") {
    return (
      <svg className={`${cls} text-subtext`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    );
  }

  if (result.type === "create_action") {
    return (
      <svg className={`${cls} text-accent`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
    );
  }

  if (result.type === "divergence" || result.type === "workspace_divergence") {
    return (
      <svg className={`${cls} text-accent`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    );
  }

  if (result.type === "session") {
    const session = result.item as WorkspaceSession;
    if (isAgentSession(session)) {
      return (
        <svg className={`${cls} text-accent`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 3h6m4 4v10a2 2 0 01-2 2H7a2 2 0 01-2-2V7m3 0V5a2 2 0 012-2h4a2 2 0 012 2v2M9 11h6M9 15h4" />
        </svg>
      );
    }
    if (isEditorSession(session)) {
      return (
        <svg className={`${cls} text-blue`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 20h9" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4 12.5-12.5z" />
        </svg>
      );
    }
    return (
      <svg className={`${cls} text-yellow`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    );
  }

  if (result.type === "workspace") {
    return (
      <svg className={`${cls} text-blue`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    );
  }

  if (result.type === "stage_tab") {
    return (
      <svg className={`${cls} text-subtext`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M3 7a2 2 0 012-2h14a2 2 0 012 2v3H3V7zm0 5h18v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5z" />
      </svg>
    );
  }

  // project
  return (
    <svg className={`${cls} text-text`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        <div className="text-text truncate font-medium text-sm">
          <HighlightedText text={file.fileName} matchedIndices={result.matchedIndices} />
        </div>
        {file.directory && <div className="text-xs text-subtext truncate">{file.directory}</div>}
      </div>
    );
  }

  if (result.type === "create_action") {
    const action = result.item as CreateAction;
    return (
      <div className="flex-1 min-w-0">
        <div className="text-text truncate text-sm">
          <HighlightedText text={action.label} matchedIndices={result.matchedIndices} />
        </div>
        <div className="text-xs text-subtext truncate">{action.description}</div>
      </div>
    );
  }

  if (result.type === "session") {
    const session = result.item as WorkspaceSession;
    const agent = isAgentSession(session) ? session : null;
    const editor = isEditorSession(session) ? session : null;
    return (
      <div className="flex-1 min-w-0">
        <div className="text-text truncate">
          <HighlightedText text={session.name} matchedIndices={result.matchedIndices} />
        </div>
        {(result.projectName || result.workspaceName) && (
          <div className="text-xs text-subtext truncate">
            {result.projectName}{result.workspaceName ? ` - ${result.workspaceName}` : ""}
          </div>
        )}
        {agent && <div className="text-xs text-subtext truncate">{agent.provider} &bull; {agent.model}</div>}
        {editor && <div className="text-xs text-subtext truncate">{editor.filePath}</div>}
      </div>
    );
  }

  if (result.type === "divergence") {
    const divergence = result.item as Divergence;
    return (
      <div className="flex-1 min-w-0">
        <div className="text-text truncate">
          <HighlightedText text={divergence.branch} matchedIndices={result.matchedIndices} />
        </div>
        {result.projectName && <div className="text-xs text-subtext truncate">{result.projectName}</div>}
      </div>
    );
  }

  if (result.type === "workspace") {
    const workspace = result.item as Workspace;
    return (
      <div className="flex-1 min-w-0">
        <div className="text-text truncate">
          <HighlightedText text={workspace.name} matchedIndices={result.matchedIndices} />
        </div>
        <div className="text-xs text-subtext truncate">{workspace.slug}</div>
      </div>
    );
  }

  if (result.type === "workspace_divergence") {
    const wd = result.item as WorkspaceDivergence;
    return (
      <div className="flex-1 min-w-0">
        <div className="text-text truncate">
          <HighlightedText text={wd.branch} matchedIndices={result.matchedIndices} />
        </div>
        {result.workspaceName && <div className="text-xs text-subtext truncate">{result.workspaceName}</div>}
      </div>
    );
  }

  if (result.type === "stage_tab") {
    const tab = result.item as StageTab;
    return (
      <div className="flex-1 min-w-0">
        <div className="text-text truncate">
          <HighlightedText text={tab.label} matchedIndices={result.matchedIndices} />
        </div>
        {result.detail && <div className="text-xs text-subtext truncate">{result.detail}</div>}
      </div>
    );
  }

  // project
  const project = result.item as { name: string };
  return (
    <div className="flex-1 min-w-0">
      <div className="text-text truncate">
        <HighlightedText text={project.name} matchedIndices={result.matchedIndices} />
      </div>
    </div>
  );
}

function ResultBadge({ result }: { result: CommandCenterSearchResult }) {
  if (result.type === "file") {
    const file = result.item as FileResult;
    if (!file.extension) return null;
    return <span className="text-xs px-1.5 py-0.5 rounded bg-surface text-subtext flex-shrink-0">{file.extension}</span>;
  }

  if (result.type === "create_action") {
    const action = result.item as CreateAction;
    return (
      <span className="text-xs px-2 py-0.5 rounded bg-accent/20 text-accent">
        {action.sessionKind === "agent" ? "Agent" : "Terminal"}
      </span>
    );
  }

  const badgeConfig = getBadgeConfig(result);
  return <span className={`text-xs px-2 py-0.5 rounded ${badgeConfig.className}`}>{badgeConfig.label}</span>;
}

function getBadgeConfig(result: CommandCenterSearchResult): { className: string; label: string } {
  if (result.type === "session") {
    const session = result.item as WorkspaceSession;
    if (isAgentSession(session)) return { className: "bg-surface text-text", label: `${session.provider} agent` };
    if (isEditorSession(session)) return { className: "bg-blue/20 text-blue", label: "editor" };
    return { className: "bg-yellow/20 text-yellow", label: "terminal" };
  }
  if (result.type === "divergence") return { className: "bg-accent/20 text-accent", label: "divergence" };
  if (result.type === "workspace") return { className: "bg-blue/20 text-blue", label: "workspace" };
  if (result.type === "workspace_divergence") return { className: "bg-accent/20 text-accent", label: "ws divergence" };
  if (result.type === "stage_tab") return { className: "bg-surface text-subtext", label: "tab" };
  return { className: "bg-surface text-subtext", label: result.type };
}

function HighlightedText({ text, matchedIndices }: { text: string; matchedIndices?: number[] }) {
  if (!matchedIndices || matchedIndices.length === 0) {
    return <>{text}</>;
  }

  const matchedIndexSet = new Set(matchedIndices);
  return (
    <>
      {Array.from(text).map((char, index) => (
        <span
          key={`${char}-${index}`}
          className={matchedIndexSet.has(index) ? "text-accent font-semibold" : undefined}
        >
          {char}
        </span>
      ))}
    </>
  );
}

export default CommandCenterResultItem;
