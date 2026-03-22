import { useCallback, useState } from "react";
import type { StageTab, StageTabId } from "../../../entities";
import { MAX_STAGE_TABS } from "../../../entities";
import StageTabBarPresentational from "./StageTabBar.presentational";

interface StageTabBarProps {
  tabs: StageTab[];
  activeTabId: StageTabId | null;
  attentionTabIds?: Set<StageTabId>;
  onSelectTab: (tabId: StageTabId) => void;
  onCreateTab: () => void;
  onCloseTab: (tabId: StageTabId) => void;
  onCloseOtherTabs: (tabId: StageTabId) => void;
  onRenameTab: (tabId: StageTabId, label: string) => void;
}

function StageTabBarContainer({
  tabs,
  activeTabId,
  attentionTabIds = new Set<StageTabId>(),
  onSelectTab,
  onCreateTab,
  onCloseTab,
  onCloseOtherTabs,
  onRenameTab,
}: StageTabBarProps) {
  const [editingTabId, setEditingTabId] = useState<StageTabId | null>(null);
  const [editingLabel, setEditingLabel] = useState("");

  const handleStartRenaming = useCallback((tabId: StageTabId, label: string) => {
    setEditingTabId(tabId);
    setEditingLabel(label);
  }, []);

  const handleCommitRename = useCallback(() => {
    if (!editingTabId) {
      return;
    }

    onRenameTab(editingTabId, editingLabel);
    setEditingTabId(null);
    setEditingLabel("");
  }, [editingLabel, editingTabId, onRenameTab]);

  const handleCancelRename = useCallback(() => {
    setEditingTabId(null);
    setEditingLabel("");
  }, []);

  return (
    <StageTabBarPresentational
      tabs={tabs}
      activeTabId={activeTabId}
      attentionTabIds={attentionTabIds}
      canCreateTab={tabs.length < MAX_STAGE_TABS}
      editingTabId={editingTabId}
      editingLabel={editingLabel}
      onSelectTab={onSelectTab}
      onCreateTab={onCreateTab}
      onCloseTab={onCloseTab}
      onCloseOtherTabs={onCloseOtherTabs}
      onStartRenaming={handleStartRenaming}
      onEditingLabelChange={setEditingLabel}
      onCommitRename={handleCommitRename}
      onCancelRename={handleCancelRename}
    />
  );
}

export type { StageTabBarProps };
export default StageTabBarContainer;
