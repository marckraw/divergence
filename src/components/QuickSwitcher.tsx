import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { Project, Divergence } from "../types";
import {
  FAST_EASE_OUT,
  OVERLAY_FADE,
  SOFT_SPRING,
  getPopVariants,
  getContentSwapVariants,
} from "../lib/motion";

interface QuickSwitcherProps {
  projects: Project[];
  divergencesByProject: Map<number, Divergence[]>;
  onSelect: (type: "project" | "divergence", item: Project | Divergence) => void;
  onClose: () => void;
}

interface SearchResult {
  type: "project" | "divergence";
  item: Project | Divergence;
  projectName?: string;
}

function QuickSwitcher({ projects, divergencesByProject, onSelect, onClose }: QuickSwitcherProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
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

  // Build searchable list
  const allItems = useMemo((): SearchResult[] => {
    const items: SearchResult[] = [];

    for (const project of projects) {
      items.push({ type: "project", item: project });

      const divergences = divergencesByProject.get(project.id) || [];
      for (const divergence of divergences) {
        items.push({
          type: "divergence",
          item: divergence,
          projectName: project.name,
        });
      }
    }

    return items;
  }, [projects, divergencesByProject]);

  // Filter by query
  const filteredItems = useMemo(() => {
    if (!query.trim()) {
      return allItems;
    }

    const lowerQuery = query.toLowerCase();
    return allItems.filter((result) => {
      const name = result.item.name.toLowerCase();
      if (result.type === "divergence") {
        const div = result.item as Divergence;
        return (
          name.includes(lowerQuery) ||
          div.branch.toLowerCase().includes(lowerQuery) ||
          result.projectName?.toLowerCase().includes(lowerQuery)
        );
      }
      return name.includes(lowerQuery);
    });
  }, [allItems, query]);

  // Reset selection when filtered items change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredItems]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Scroll selected item into view
  useEffect(() => {
    const list = listRef.current;
    if (list && filteredItems.length > 0) {
      const item = list.children[selectedIndex] as HTMLElement;
      item?.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex, filteredItems.length]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < filteredItems.length - 1 ? prev + 1 : prev
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
          break;
        case "Enter":
          e.preventDefault();
          if (filteredItems[selectedIndex]) {
            const result = filteredItems[selectedIndex];
            onSelect(result.type, result.item);
          }
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    },
    [filteredItems, selectedIndex, onSelect, onClose]
  );

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
        onClick={(e) => e.stopPropagation()}
        variants={panelVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        transition={panelTransition}
      >
        {/* Search Input */}
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
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search projects and divergences..."
              className="flex-1 bg-transparent text-text placeholder-subtext focus:outline-none"
            />
            <kbd className="text-xs text-subtext bg-surface px-1.5 py-0.5 rounded">
              esc
            </kbd>
          </div>
        </div>

        {/* Results */}
        <div ref={listRef} className="flex-1 overflow-y-auto p-2">
          {filteredItems.length === 0 ? (
            <div className="text-center py-8 text-subtext">
              No results found
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {filteredItems.map((result, index) => (
                <motion.div
                  key={`${result.type}-${result.item.id}`}
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
                  onClick={() => onSelect(result.type, result.item)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  {/* Icon */}
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

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="text-text truncate">
                      {result.type === "divergence"
                        ? (result.item as Divergence).branch
                        : result.item.name}
                    </div>
                    {result.type === "divergence" && result.projectName && (
                      <div className="text-xs text-subtext truncate">
                        {result.projectName}
                      </div>
                    )}
                  </div>

                  {/* Type badge */}
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${
                        result.type === "divergence"
                          ? "bg-accent/20 text-accent"
                          : "bg-surface text-subtext"
                      }`}
                    >
                      {result.type}
                    </span>
                    {result.type === "divergence" && (
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded border ${
                          (result.item as Divergence).mode === "worktree"
                            ? "bg-accent/15 text-accent border-accent/30"
                            : "bg-surface text-subtext border-surface"
                        }`}
                      >
                        {(result.item as Divergence).mode === "worktree" ? "worktree" : "clone"}
                      </span>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>

        {/* Footer hint */}
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

export default QuickSwitcher;
