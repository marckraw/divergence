import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn.pure";
import TabButton from "./TabButton.presentational";

export interface DocumentPanelTabItem {
  id: string;
  panelId: string;
  label: ReactNode;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}

export interface DocumentPanelTabsProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  ariaLabel: string;
  items: DocumentPanelTabItem[];
}

function DocumentPanelTabs({
  ariaLabel,
  items,
  className,
  ...rest
}: DocumentPanelTabsProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div
      className={cn("flex items-center border-b border-surface text-xs", className)}
      role="tablist"
      aria-label={ariaLabel}
      {...rest}
    >
      {items.map((item) => (
        <TabButton
          key={item.id}
          active={item.active}
          role="tab"
          id={item.id}
          aria-selected={item.active}
          aria-controls={item.panelId}
          tabIndex={item.active ? 0 : -1}
          disabled={item.disabled}
          onClick={item.onClick}
        >
          {item.label}
        </TabButton>
      ))}
    </div>
  );
}

export default DocumentPanelTabs;
