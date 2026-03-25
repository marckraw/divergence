import { TabButton } from "../../../shared";
import type { CommandCenterCategory } from "./CommandCenter.types";

interface CommandCenterCategoryTabsProps {
  activeCategory: CommandCenterCategory;
  onCategoryChange: (category: CommandCenterCategory) => void;
}

const CATEGORIES: { id: CommandCenterCategory; label: string }[] = [
  { id: "all", label: "All" },
  { id: "files", label: "Files" },
  { id: "sessions", label: "Sessions" },
  { id: "create", label: "Create" },
];

function CommandCenterCategoryTabs({ activeCategory, onCategoryChange }: CommandCenterCategoryTabsProps) {
  return (
    <div className="flex items-center border-b border-surface px-2">
      {CATEGORIES.map((cat) => (
        <TabButton
          key={cat.id}
          active={activeCategory === cat.id}
          onClick={() => onCategoryChange(cat.id)}
        >
          {cat.label}
        </TabButton>
      ))}
    </div>
  );
}

export default CommandCenterCategoryTabs;
