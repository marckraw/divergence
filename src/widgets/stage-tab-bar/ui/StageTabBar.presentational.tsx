import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
  IconButton,
  ToolbarButton,
} from "../../../shared";
import type { StageTab, StageTabId } from "../../../entities";

interface StageTabBarPresentationalProps {
  tabs: StageTab[];
  activeTabId: StageTabId | null;
  attentionTabIds: Set<StageTabId>;
  canCreateTab: boolean;
  maxStageTabs: number;
  editingTabId: StageTabId | null;
  editingLabel: string;
  onSelectTab: (tabId: StageTabId) => void;
  onCreateTab: () => void;
  onCloseTab: (tabId: StageTabId) => void;
  onCloseOtherTabs: (tabId: StageTabId) => void;
  onStartRenaming: (tabId: StageTabId, label: string) => void;
  onEditingLabelChange: (label: string) => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
}

function StageTabBarPresentational({
  tabs,
  activeTabId,
  attentionTabIds,
  canCreateTab,
  maxStageTabs,
  editingTabId,
  editingLabel,
  onSelectTab,
  onCreateTab,
  onCloseTab,
  onCloseOtherTabs,
  onStartRenaming,
  onEditingLabelChange,
  onCommitRename,
  onCancelRename,
}: StageTabBarPresentationalProps) {
  return (
    <div className="border-b border-surface bg-sidebar/80 px-2 py-1">
      <div className="flex items-center gap-1 overflow-x-auto whitespace-nowrap">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const isEditing = tab.id === editingTabId;
          const hasAttention = attentionTabIds.has(tab.id);

          const content = (
            <div
              role="button"
              tabIndex={0}
              className={`group flex min-w-[8rem] max-w-[12rem] items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                isActive
                  ? "border-surface bg-main text-text shadow-[0_1px_0_rgba(255,255,255,0.04)]"
                  : "border-transparent bg-surface/30 text-subtext hover:border-surface/80 hover:bg-surface/60 hover:text-text"
              }`}
              onClick={() => onSelectTab(tab.id)}
              onDoubleClick={() => onStartRenaming(tab.id, tab.label)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelectTab(tab.id);
                }
              }}
              aria-pressed={isActive}
              aria-label={`Switch to ${tab.label}`}
            >
              <span className={`h-2 w-2 rounded-full ${hasAttention ? "bg-yellow" : "bg-accent/60"}`} />
              {isEditing ? (
                <input
                  autoFocus
                  type="text"
                  value={editingLabel}
                  onChange={(event) => onEditingLabelChange(event.target.value)}
                  onBlur={onCommitRename}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      onCommitRename();
                    } else if (event.key === "Escape") {
                      event.preventDefault();
                      onCancelRename();
                    }
                  }}
                  className="min-w-0 flex-1 rounded bg-main px-1 py-0.5 text-sm text-text outline-none ring-1 ring-accent/40"
                  onClick={(event) => event.stopPropagation()}
                />
              ) : (
                <span className="min-w-0 flex-1 truncate text-left">{tab.label}</span>
              )}
              {!isEditing ? (
                <IconButton
                  className={`h-5 w-5 rounded text-subtext hover:text-text ${
                    isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                  }`}
                  variant="ghost"
                  size="xs"
                  label={`Close ${tab.label}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onCloseTab(tab.id);
                  }}
                  icon={(
                    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18 18 6M6 6l12 12" />
                    </svg>
                  )}
                />
              ) : null}
            </div>
          );

          return (
            <ContextMenu key={tab.id}>
              <ContextMenuTrigger asChild>
                {content}
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuItem onSelect={() => onStartRenaming(tab.id, tab.label)}>
                  Rename Tab
                </ContextMenuItem>
                <ContextMenuItem onSelect={() => onCloseTab(tab.id)} disabled={tabs.length === 0}>
                  Close Tab
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem onSelect={() => onCloseOtherTabs(tab.id)} disabled={tabs.length <= 1}>
                  Close Other Tabs
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          );
        })}

        <ToolbarButton
          onClick={onCreateTab}
          disabled={!canCreateTab}
          title={canCreateTab ? "Create a new layout tab (Cmd+T)" : `Maximum of ${maxStageTabs} layout tabs`}
        >
          +
        </ToolbarButton>
      </div>
    </div>
  );
}

export type { StageTabBarPresentationalProps };
export default StageTabBarPresentational;
