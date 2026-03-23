import type { WorkspaceSession } from "../../../entities";
import { isAgentSession } from "../../../entities";
import { Kbd, getFileBadgeInfo } from "../../../shared";
import type { CommandCenterResultItemProps } from "./CommandCenter.types";
import { getCommandCenterResultKey } from "../lib/commandCenter.pure";

function getResultMeta(result: CommandCenterResultItemProps["result"]): {
  badge: string;
  title: string;
  detail: string;
} {
  switch (result.type) {
    case "project":
      return {
        badge: "project",
        title: result.item.name,
        detail: result.item.path,
      };
    case "divergence":
      return {
        badge: "divergence",
        title: result.item.branch,
        detail: result.projectName ?? result.item.path,
      };
    case "workspace":
      return {
        badge: "workspace",
        title: result.item.name,
        detail: result.item.folderPath,
      };
    case "workspace_divergence":
      return {
        badge: "ws div",
        title: result.item.branch,
        detail: result.workspaceName ?? result.item.folderPath,
      };
    case "session": {
      const session = result.item as WorkspaceSession;
      return {
        badge: isAgentSession(session) ? `${session.provider} agent` : "session",
        title: session.name,
        detail: isAgentSession(session)
          ? `${session.provider} • ${session.model}`
          : `${session.type} • ${session.path}`,
      };
    }
    case "file":
      return {
        badge: getFileBadgeInfo(result.item.fileName).label,
        title: result.item.fileName,
        detail: result.item.directory || result.item.relativePath,
      };
    case "create_action":
      return {
        badge: result.item.sessionKind,
        title: result.item.label,
        detail: result.item.description,
      };
  }
}

function CommandCenterResultItem({
  result,
  selected,
  onSelect,
  onHover,
}: CommandCenterResultItemProps) {
  const meta = getResultMeta(result);
  const fileBadge = result.type === "file" ? getFileBadgeInfo(result.item.fileName) : null;

  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseEnter={onHover}
      data-command-center-item={getCommandCenterResultKey(result)}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors ${
        selected
          ? "bg-accent/12 ring-1 ring-inset ring-accent/40"
          : "hover:bg-surface/60"
      }`}
    >
      <span
        className={`shrink-0 rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${
          fileBadge ? fileBadge.className : "bg-surface text-subtext"
        }`}
      >
        {meta.badge}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-text">{meta.title}</span>
        <span className="block truncate text-xs text-subtext">{meta.detail}</span>
      </span>
      {selected && (
        <span className="hidden shrink-0 text-subtext sm:inline-flex">
          <Kbd>enter</Kbd>
        </span>
      )}
    </button>
  );
}

export default CommandCenterResultItem;
