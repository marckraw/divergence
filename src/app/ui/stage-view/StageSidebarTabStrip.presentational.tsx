import type { ReactNode } from "react";
import { TabButton } from "../../../shared";

export interface StageSidebarTabItem<T extends string> {
  id: T;
  label: ReactNode;
}

interface StageSidebarTabStripProps<T extends string> {
  tabs: StageSidebarTabItem<T>[];
  activeTab: T;
  onTabChange: (tab: T) => void;
}

function StageSidebarTabStrip<T extends string>({
  tabs,
  activeTab,
  onTabChange,
}: StageSidebarTabStripProps<T>) {
  return (
    <div className="flex items-center border-b border-surface">
      {tabs.map((tab) => (
        <TabButton key={tab.id} active={activeTab === tab.id} onClick={() => onTabChange(tab.id)}>
          {tab.label}
        </TabButton>
      ))}
    </div>
  );
}

export default StageSidebarTabStrip;
