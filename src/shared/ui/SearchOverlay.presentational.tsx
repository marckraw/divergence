import { useMemo } from "react";
import type { KeyboardEvent, MouseEvent, ReactNode, RefObject } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { FAST_EASE_OUT, OVERLAY_FADE, SOFT_SPRING, getPopVariants } from "../lib/motion.pure";

interface SearchOverlayPresentationalProps {
  query: string;
  placeholder: string;
  inputRef: RefObject<HTMLInputElement>;
  listRef: RefObject<HTMLDivElement>;
  onClose: () => void;
  onPanelClick: (event: MouseEvent<HTMLDivElement>) => void;
  onQueryChange: (value: string) => void;
  onInputKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  footer: ReactNode;
  children: ReactNode;
  panelClassName?: string;
  listClassName?: string;
  footerClassName?: string;
}

function SearchOverlayPresentational({
  query,
  placeholder,
  inputRef,
  listRef,
  onClose,
  onPanelClick,
  onQueryChange,
  onInputKeyDown,
  footer,
  children,
  panelClassName = "bg-sidebar border border-surface rounded-lg shadow-xl w-[500px] max-h-[400px] flex flex-col",
  listClassName = "flex-1 overflow-y-auto p-2",
  footerClassName = "p-2 border-t border-surface text-xs text-subtext flex items-center justify-center gap-4",
}: SearchOverlayPresentationalProps) {
  const shouldReduceMotion = useReducedMotion();
  const panelVariants = useMemo(
    () => getPopVariants(shouldReduceMotion),
    [shouldReduceMotion]
  );
  const panelTransition = shouldReduceMotion ? FAST_EASE_OUT : SOFT_SPRING;

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
        className={panelClassName}
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
              placeholder={placeholder}
              className="flex-1 bg-transparent text-text placeholder-subtext focus:outline-none"
            />
            <kbd className="text-xs text-subtext bg-surface px-1.5 py-0.5 rounded">
              esc
            </kbd>
          </div>
        </div>
        <div ref={listRef} className={listClassName}>
          {children}
        </div>
        <div className={footerClassName}>{footer}</div>
      </motion.div>
    </motion.div>
  );
}

export default SearchOverlayPresentational;
