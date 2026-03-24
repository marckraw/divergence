import {
  EmptyState,
  Kbd,
  ModalShell,
} from "../../../shared";
import { getModeBadgeLabel, groupResultsByCategory } from "../lib/commandCenter.pure";
import type { CommandCenterPresentationalProps } from "./CommandCenter.types";
import CommandCenterCategoryTabs from "./CommandCenterCategoryTabs.presentational";
import CommandCenterResultItem from "./CommandCenterResultItem.presentational";

function CommandCenterPresentational({
  mode,
  query,
  selectedIndex,
  activeCategory,
  visibleItems,
  totalFilteredCount,
  isLoadingFiles,
  contextLabel,
  showCategoryTabs,
  resultsKey,
  inputRef,
  listRef,
  onClose,
  onQueryChange,
  onInputKeyDown,
  onSelectResult,
  onHoverResult,
  onCategoryChange,
  onAfterPanelEnter,
  onAfterOverlayExit,
}: CommandCenterPresentationalProps) {
  const modeLabel = getModeBadgeLabel(mode);
  const groups = groupResultsByCategory(visibleItems);

  // Compute a flat index mapping for grouped rendering
  let flatIndex = 0;
  const groupsWithIndices = groups.map((group) => {
    const items = group.items.map((item) => {
      const idx = flatIndex;
      flatIndex++;
      return { item, flatIndex: idx };
    });
    return { ...group, items };
  });

  return (
    <ModalShell
      onRequestClose={onClose}
      size="xl"
      surface="sidebar"
      overlayClassName="items-start justify-center pt-[20vh] z-50"
      panelClassName="w-[600px] max-h-[60vh] flex flex-col"
      dataCommandCenterRoot
      onPanelAnimationComplete={onAfterPanelEnter}
      onOverlayExitComplete={onAfterOverlayExit}
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
            placeholder={getPlaceholder(mode.kind)}
            className="flex-1 bg-transparent text-text placeholder-subtext focus:outline-none"
          />
          <Kbd className="text-subtext">esc</Kbd>
        </div>
      </div>

      {/* Context line */}
      <div className="flex items-center gap-2 px-4 py-1.5 text-xs text-subtext border-b border-surface">
        <span className={`rounded-full px-2 py-0.5 uppercase tracking-[0.16em] ${
          mode.kind === "reveal"
            ? "bg-accent/20 text-accent"
            : "bg-surface text-subtext"
        }`}>
          {modeLabel}
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

      {/* Results */}
      <div ref={listRef} className="flex-1 overflow-y-auto p-2">
        {isLoadingFiles && visibleItems.length === 0 ? (
          <div className="flex items-center justify-center py-8 gap-2 text-subtext">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span>Loading files...</span>
          </div>
        ) : visibleItems.length === 0 ? (
          <EmptyState>No results found</EmptyState>
        ) : (
          <div key={resultsKey}>
            {groupsWithIndices.map((group) => (
              <div key={group.category}>
                <div className="px-2 pt-3 pb-1 text-[10px] uppercase tracking-[0.14em] text-subtext">
                  {group.label}
                </div>
                {group.items.map(({ item: result, flatIndex: idx }) => (
                  <CommandCenterResultItem
                    key={`${result.type}-${result.item.id}`}
                    result={result}
                    isSelected={idx === selectedIndex}
                    onClick={() => onSelectResult(result)}
                    onMouseEnter={() => onHoverResult(idx)}
                  />
                ))}
              </div>
            ))}
            {totalFilteredCount > visibleItems.length && (
              <div className="px-2 pt-3 pb-2 text-xs text-subtext">
                {`Showing ${visibleItems.length.toLocaleString()} of ${totalFilteredCount.toLocaleString()} results. Type to narrow down.`}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-2 border-t border-surface text-xs text-subtext flex items-center justify-center gap-4">
        <span><Kbd className="px-1">up/down</Kbd> navigate</span>
        <span><Kbd className="px-1">enter</Kbd> select</span>
        {showCategoryTabs && <span><Kbd className="px-1">tab</Kbd> category</span>}
        <span><Kbd className="px-1">esc</Kbd> close</span>
      </div>
    </ModalShell>
  );
}

function getPlaceholder(kind: string): string {
  switch (kind) {
    case "reveal":
      return "Jump to an existing session or tab...";
    case "open-file":
      return "Search files...";
    case "open-in-pane":
      return "Search files, sessions, or create new...";
    default:
      return "Search projects, files, sessions, and more...";
  }
}

export default CommandCenterPresentational;
