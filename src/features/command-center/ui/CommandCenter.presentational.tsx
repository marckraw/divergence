import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { EmptyState, FAST_EASE_OUT, Kbd, ModalShell, getContentSwapVariants } from "../../../shared";
import CommandCenterCategoryTabs from "./CommandCenterCategoryTabs.presentational";
import CommandCenterResultItem from "./CommandCenterResultItem.presentational";
import type { CommandCenterPresentationalProps } from "./CommandCenter.types";

function CommandCenterPresentational({
  mode,
  query,
  groups,
  flatResults,
  activeCategory,
  availableCategories,
  selectedIndex,
  isLoadingFiles,
  fileError,
  filesTruncated,
  sourceContext,
  inputRef,
  listRef,
  onQueryChange,
  onInputKeyDown,
  onSelectResult,
  onHoverResult,
  onCategoryChange,
  onClose,
}: CommandCenterPresentationalProps) {
  const shouldReduceMotion = useReducedMotion();
  const itemVariants = getContentSwapVariants(shouldReduceMotion);
  const itemTransition = shouldReduceMotion
    ? FAST_EASE_OUT
    : { type: "spring", stiffness: 280, damping: 28, mass: 0.8 };
  const showCategoryTabs = availableCategories.length > 1;
  const placeholder = mode.kind === "open-file"
    ? "Search files..."
    : mode.kind === "reveal"
      ? "Search sessions..."
      : "Search files, sessions, projects, and actions...";

  return (
    <ModalShell
      onRequestClose={onClose}
      size="xl"
      surface="sidebar"
      overlayClassName="z-50 items-start justify-center pt-[12vh]"
      panelClassName="flex max-h-[60vh] w-[600px] flex-col overflow-hidden"
    >
      <div className="border-b border-surface px-4 py-4">
        <div className="flex items-center gap-3 rounded-2xl border border-surface bg-main/80 px-4 py-3">
          <svg className="h-4 w-4 text-subtext" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder={placeholder}
            className="flex-1 bg-transparent text-sm text-text placeholder-subtext focus:outline-none"
          />
          <Kbd>esc</Kbd>
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs text-subtext">
          <span className="rounded-full border border-accent/50 bg-accent/10 px-2 py-0.5 font-medium text-accent">
            {sourceContext.badgeLabel}
          </span>
          <span className="truncate">{sourceContext.description}</span>
        </div>
      </div>

      {showCategoryTabs && (
        <CommandCenterCategoryTabs
          categories={availableCategories}
          activeCategory={activeCategory}
          onSelectCategory={onCategoryChange}
        />
      )}

      <div ref={listRef} className="flex-1 overflow-y-auto px-2 py-3">
        {fileError ? (
          <div className="px-3 py-8 text-center text-sm text-red-300">{fileError}</div>
        ) : isLoadingFiles && flatResults.length === 0 ? (
          <div className="space-y-2 px-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-14 animate-pulse rounded-xl bg-surface/60" />
            ))}
          </div>
        ) : flatResults.length === 0 ? (
          <EmptyState>No results found</EmptyState>
        ) : (
          <AnimatePresence initial={false}>
            {groups.map((group) => (
              <div key={group.id} className="mb-4 last:mb-0">
                {activeCategory === "all" && (
                  <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-subtext">
                    {group.heading}
                  </div>
                )}
                <div className="space-y-1">
                  {group.results.map((result) => {
                    const index = flatResults.findIndex((item) => item === result);
                    return (
                      <motion.div
                        key={`${result.type}-${index}`}
                        layout={shouldReduceMotion ? undefined : "position"}
                        variants={itemVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        transition={itemTransition}
                      >
                        <CommandCenterResultItem
                          result={result}
                          selected={index === selectedIndex}
                          onSelect={() => onSelectResult(result)}
                          onHover={() => onHoverResult(index)}
                        />
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            ))}
          </AnimatePresence>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-4 border-t border-surface px-4 py-3 text-xs text-subtext">
        <span><Kbd>up/down</Kbd> navigate</span>
        <span><Kbd>enter</Kbd> select</span>
        {showCategoryTabs && <span><Kbd>tab</Kbd> categories</span>}
        {filesTruncated && <span>File list truncated</span>}
      </div>
    </ModalShell>
  );
}

export default CommandCenterPresentational;
