import { useMemo } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  FAST_EASE_OUT,
  OVERLAY_FADE,
  SOFT_SPRING,
  getContentSwapVariants,
  getPopVariants,
} from "../../../lib/motion";
import { getFileQuickSwitcherInfo } from "../../../lib/utils/fileQuickSwitcher";
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
  const panelVariants = useMemo(
    () => getPopVariants(shouldReduceMotion),
    [shouldReduceMotion]
  );
  const itemVariants = useMemo(
    () => getContentSwapVariants(shouldReduceMotion),
    [shouldReduceMotion]
  );
  const panelTransition = shouldReduceMotion ? FAST_EASE_OUT : SOFT_SPRING;
  const itemTransition = shouldReduceMotion
    ? FAST_EASE_OUT
    : { type: "spring", stiffness: 300, damping: 32, mass: 0.8 };

  return (
    <motion.div
      className="fixed inset-0 bg-black/50 flex items-start justify-center pt-[20vh] z-50"
      onClick={onClose}
      variants={OVERLAY_FADE}
      initial="hidden"
      animate="visible"
      exit="exit"
      transition={FAST_EASE_OUT}
    >
      <motion.div
        className="bg-sidebar border border-surface rounded-lg shadow-xl w-[500px] max-h-[400px] flex flex-col"
        onClick={onPanelClick}
        variants={panelVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        transition={panelTransition}
      >
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
              placeholder="Search files..."
              className="flex-1 bg-transparent text-text placeholder-subtext focus:outline-none"
            />
            <kbd className="text-xs text-subtext bg-surface px-1.5 py-0.5 rounded">
              esc
            </kbd>
          </div>
        </div>

        <div ref={listRef} className="flex-1 overflow-y-auto p-2">
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
        </div>

        <div className="p-2 border-t border-surface text-xs text-subtext flex items-center justify-between">
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
        </div>
      </motion.div>
    </motion.div>
  );
}

export default FileQuickSwitcherPresentational;
