import { useMemo } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  FAST_EASE_OUT,
  getContentSwapVariants,
  SearchOverlay,
} from "../../../shared";
import { getFileQuickSwitcherInfo } from "../lib/fileQuickSwitcher.pure";
import type { FileQuickSwitcherPresentationalProps } from "./FileQuickSwitcher.types";

function FileQuickSwitcherPresentational({
  query,
  selectedIndex,
  filteredCount,
  displayFiles,
  overflowCount,
  isLoading,
  error,
  truncated,
  inputRef,
  listRef,
  onClose,
  onPanelClick,
  onQueryChange,
  onInputKeyDown,
  onSelectFile,
  onHoverIndex,
}: FileQuickSwitcherPresentationalProps) {
  const shouldReduceMotion = useReducedMotion();
  const itemVariants = useMemo(
    () => getContentSwapVariants(shouldReduceMotion),
    [shouldReduceMotion]
  );
  const itemTransition = shouldReduceMotion
    ? FAST_EASE_OUT
    : { type: "spring", stiffness: 300, damping: 32, mass: 0.8 };

  return (
    <SearchOverlay
      query={query}
      placeholder="Search files..."
      inputRef={inputRef}
      listRef={listRef}
      onClose={onClose}
      onPanelClick={onPanelClick}
      onQueryChange={onQueryChange}
      onInputKeyDown={onInputKeyDown}
      footerClassName="p-2 border-t border-surface text-xs text-subtext flex items-center justify-between"
      footer={(
        <>
          <span>
            {filteredCount} file{filteredCount !== 1 ? "s" : ""}
            {truncated && " (list truncated)"}
          </span>
          <div className="flex items-center gap-4">
            <span>
              <kbd className="px-1 py-0.5 bg-surface rounded">↑↓</kbd> navigate
            </span>
            <span>
              <kbd className="px-1 py-0.5 bg-surface rounded">↵</kbd> open
            </span>
            <span>
              <kbd className="px-1 py-0.5 bg-surface rounded">esc</kbd> close
            </span>
          </div>
        </>
      )}
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-8 gap-2 text-subtext">
          <svg
            className="w-4 h-4 animate-spin"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <span>Loading files...</span>
        </div>
      ) : error ? (
        <div className="text-center py-8 text-red">{error}</div>
      ) : displayFiles.length === 0 ? (
        <div className="text-center py-8 text-subtext">
          No files found
        </div>
      ) : (
        <AnimatePresence initial={false}>
          {displayFiles.map((filePath, index) => {
            const { fileName, directory, extension } = getFileQuickSwitcherInfo(filePath);
            return (
              <motion.div
                key={filePath}
                layout={shouldReduceMotion ? undefined : "position"}
                variants={itemVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                transition={itemTransition}
                className={`flex items-center gap-3 px-3 py-2 rounded cursor-pointer transition-colors ${
                  index === selectedIndex
                    ? "bg-surface"
                    : "hover:bg-surface/50"
                }`}
                onClick={() => onSelectFile(filePath)}
                onMouseEnter={() => onHoverIndex(index)}
              >
                <svg
                  className="w-4 h-4 text-subtext flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                  />
                </svg>

                <div className="flex-1 min-w-0">
                  <div className="text-text truncate font-medium text-sm">
                    {fileName}
                  </div>
                  {directory && (
                    <div className="text-xs text-subtext truncate">
                      {directory}
                    </div>
                  )}
                </div>

                {extension && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-surface text-subtext flex-shrink-0">
                    {extension}
                  </span>
                )}
              </motion.div>
            );
          })}
          {overflowCount > 0 && (
            <div className="text-center py-2 text-xs text-subtext">
              {overflowCount} more matches...
            </div>
          )}
        </AnimatePresence>
      )}
    </SearchOverlay>
  );
}

export default FileQuickSwitcherPresentational;
