import { useMemo } from "react";
import {
  EmptyState,
  Kbd,
  ModalShell,
} from "../../../shared";
import { groupResultsByCategory } from "../lib/commandCenter.pure";
import CommandCenterResultItem from "./CommandCenterResultItem.presentational";
import CommandCenterCategoryTabs from "./CommandCenterCategoryTabs.presentational";
import type { CommandCenterPresentationalProps } from "./CommandCenter.types";

const MODE_LABELS: Record<string, string> = {
  replace: "Replace",
  reveal: "Reveal",
  "open-in-pane": "Open in Pane",
  "open-file": "File Search",
};

function CommandCenterPresentational({
  mode,
  query,
  selectedIndex,
  activeCategory,
  filteredItems,
  isLoadingFiles,
  showCategoryTabs,
  contextLabel,
  inputRef,
  listRef,
  onClose,
  onQueryChange,
  onInputKeyDown,
  onSelectResult,
  onHoverResult,
  onCategoryChange,
}: CommandCenterPresentationalProps) {
  const grouped = useMemo(() => groupResultsByCategory(filteredItems), [filteredItems]);

  // Build a flat index map so we can determine which item index corresponds to which grouped position
  let flatIndex = 0;

  return (
    <ModalShell
      onRequestClose={onClose}
      size="xl"
      surface="sidebar"
      overlayClassName="items-start justify-center pt-[20vh] z-50"
      panelClassName="w-[600px] max-h-[60vh] flex flex-col"
    >
      {/* Search input */}
      <div className="p-3 border-b border-surface">
        <div className="flex items-center gap-2 bg-main px-3 py-2 rounded">
          <svg
            className="w-4 h-4 text-subtext"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder={mode.kind === "open-file" ? "Search files..." : "Search projects, sessions, files, and more..."}
            className="flex-1 bg-transparent text-text placeholder-subtext focus:outline-none"
          />
          <Kbd className="text-subtext">esc</Kbd>
        </div>
      </div>

      {/* Context line */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-surface text-xs text-subtext">
        <span className="px-1.5 py-0.5 rounded bg-surface text-text font-medium">
          {MODE_LABELS[mode.kind] ?? mode.kind}
        </span>
        {contextLabel && <span className="truncate">{contextLabel}</span>}
      </div>

      {/* Category tabs */}
      {showCategoryTabs && (
        <CommandCenterCategoryTabs
          activeCategory={activeCategory}
          onCategoryChange={onCategoryChange}
        />
      )}

      {/* Result list */}
      <div ref={listRef} className="flex-1 overflow-y-auto p-2">
        {isLoadingFiles && filteredItems.length === 0 ? (
          <div className="flex items-center justify-center py-8 gap-2 text-subtext">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span>Loading files...</span>
          </div>
        ) : filteredItems.length === 0 ? (
          <EmptyState>No results found</EmptyState>
        ) : (
          grouped.map((group) => {
            const groupItems = group.items.map((result) => {
              const currentIndex = flatIndex;
              flatIndex++;
              return (
                <CommandCenterResultItem
                  key={`${result.type}-${result.type === "file" ? (result.item as { id: string }).id : result.type === "create_action" ? (result.item as { id: string }).id : (result.item as { id: number | string }).id}`}
                  result={result}
                  isSelected={currentIndex === selectedIndex}
                  onClick={() => onSelectResult(result)}
                  onMouseEnter={() => onHoverResult(currentIndex)}
                />
              );
            });

            return (
              <div key={group.label} className="mb-2">
                <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-subtext">
                  {group.label}
                </div>
                {groupItems}
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="p-2 border-t border-surface text-xs text-subtext flex items-center justify-center gap-4">
        <span>
          <Kbd className="px-1">up/down</Kbd> navigate
        </span>
        <span>
          <Kbd className="px-1">enter</Kbd> select
        </span>
        {showCategoryTabs && (
          <span>
            <Kbd className="px-1">tab</Kbd> category
          </span>
        )}
        <span>
          <Kbd className="px-1">esc</Kbd> close
        </span>
      </div>
    </ModalShell>
  );
}

export default CommandCenterPresentational;
