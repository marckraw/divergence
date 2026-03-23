import { Button } from "../../../shared";
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

function CommandCenterCategoryTabs({
  activeCategory,
  onCategoryChange,
}: CommandCenterCategoryTabsProps) {
  return (
    <div className="flex items-center gap-1 px-3 py-1.5 border-b border-surface">
      {CATEGORIES.map((cat) => (
        <Button
          key={cat.id}
          type="button"
          variant="ghost"
          size="sm"
          className={`px-2.5 py-1 text-xs rounded transition-colors ${
            activeCategory === cat.id
              ? "bg-surface text-text font-medium"
              : "text-subtext hover:text-text hover:bg-surface/50"
          }`}
          onClick={() => onCategoryChange(cat.id)}
        >
          {cat.label}
        </Button>
      ))}
    </div>
  );
}

export default CommandCenterCategoryTabs;
