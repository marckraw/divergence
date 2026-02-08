import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { Divergence, TerminalSession } from "../../../entities";
import {
  FAST_EASE_OUT,
  OVERLAY_FADE,
  SOFT_SPRING,
  getPopVariants,
  getContentSwapVariants,
} from "../../../shared/lib/motion";
import type { QuickSwitcherPresentationalProps } from "./QuickSwitcher.types";

function QuickSwitcherPresentational({
  query,
  selectedIndex,
  filteredItems,
  inputRef,
  listRef,
  onClose,
  onPanelClick,
  onQueryChange,
  onInputKeyDown,
  onSelectResult,
  onHoverResult,
}: QuickSwitcherPresentationalProps) {
  const shouldReduceMotion = useReducedMotion();
  const panelVariants = getPopVariants(shouldReduceMotion);
  const itemVariants = getContentSwapVariants(shouldReduceMotion);
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
              placeholder="Search projects, divergences, and sessions..."
              className="flex-1 bg-transparent text-text placeholder-subtext focus:outline-none"
            />
            <kbd className="text-xs text-subtext bg-surface px-1.5 py-0.5 rounded">
              esc
            </kbd>
          </div>
        </div>

        <div ref={listRef} className="flex-1 overflow-y-auto p-2">
          {filteredItems.length === 0 ? (
            <div className="text-center py-8 text-subtext">
              No results found
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {filteredItems.map((result, index) => (
                <motion.div
                  key={`${result.type}-${result.type === "session" ? (result.item as TerminalSession).id : result.item.id}`}
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
                  onClick={() => onSelectResult(result)}
                  onMouseEnter={() => onHoverResult(index)}
                >
                  {result.type === "divergence" ? (
                    <svg
                      className="w-5 h-5 text-accent"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                      />
                    </svg>
                  ) : result.type === "session" ? (
                    <svg
                      className="w-5 h-5 text-yellow"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-5 h-5 text-text"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                      />
                    </svg>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="text-text truncate">
                      {result.type === "divergence"
                        ? (result.item as Divergence).branch
                        : result.type === "session"
                          ? (result.item as TerminalSession).name
                        : result.item.name}
                    </div>
                    {(result.type === "divergence" || result.type === "session") && result.projectName && (
                      <div className="text-xs text-subtext truncate">
                        {result.type === "session"
                          ? `${result.projectName}${result.workspaceName ? ` • ${result.workspaceName}` : ""}`
                          : result.projectName}
                      </div>
                    )}
                  </div>

                  <span
                    className={`text-xs px-2 py-0.5 rounded ${
                      result.type === "divergence"
                        ? "bg-accent/20 text-accent"
                        : result.type === "session"
                          ? "bg-yellow/20 text-yellow"
                        : "bg-surface text-subtext"
                    }`}
                  >
                    {result.type}
                  </span>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>

        <div className="p-2 border-t border-surface text-xs text-subtext flex items-center justify-center gap-4">
          <span>
            <kbd className="px-1 py-0.5 bg-surface rounded">↑↓</kbd> navigate
          </span>
          <span>
            <kbd className="px-1 py-0.5 bg-surface rounded">↵</kbd> select
          </span>
          <span>
            <kbd className="px-1 py-0.5 bg-surface rounded">esc</kbd> close
          </span>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default QuickSwitcherPresentational;
