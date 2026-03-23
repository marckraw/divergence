import type { CommandCenterCategory, CommandCenterCategoryTabsProps } from "./CommandCenter.types";

const CATEGORY_LABELS: Record<CommandCenterCategory, string> = {
  all: "All",
  files: "Files",
  sessions: "Sessions",
  navigation: "Navigate",
  create: "Create",
};

function CommandCenterCategoryTabs({
  categories,
  activeCategory,
  onSelectCategory,
}: CommandCenterCategoryTabsProps) {
  return (
    <div className="flex flex-wrap gap-2 border-b border-surface px-4 py-3">
      {categories.map((category) => (
        <button
          key={category}
          type="button"
          onClick={() => onSelectCategory(category)}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
            category === activeCategory
              ? "border-accent/70 bg-accent/15 text-accent"
              : "border-surface bg-main/60 text-subtext hover:bg-surface/70 hover:text-text"
          }`}
        >
          {CATEGORY_LABELS[category]}
        </button>
      ))}
    </div>
  );
}

export default CommandCenterCategoryTabs;
