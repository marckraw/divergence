import { ToolbarButton } from "../../../shared";
import UsageLimitsPopover from "./UsageLimitsPopover.presentational";
import type { UsageLimitsPopoverProps } from "./UsageLimitsPopover.types";

interface UsageLimitsButtonPresentationalProps extends UsageLimitsPopoverProps {
  containerRef: { current: HTMLDivElement | null };
  isOpen: boolean;
  dotColor: string;
  showDot: boolean;
  onToggle: () => void;
}

function UsageLimitsButtonPresentational({
  containerRef,
  isOpen,
  dotColor,
  showDot,
  onToggle,
  codex,
  loading,
  lastFetchedAtMs,
  onRefresh,
}: UsageLimitsButtonPresentationalProps) {
  return (
    <div ref={containerRef} className="relative">
      <ToolbarButton
        iconOnly
        onClick={onToggle}
        title="Usage limits"
        aria-label="Usage limits"
        aria-expanded={isOpen}
      >
        <div className="relative">
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          {showDot && (
            <span className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ${dotColor}`} />
          )}
        </div>
      </ToolbarButton>
      {isOpen && (
        <div className="absolute right-0 top-full mt-1 z-50">
          <UsageLimitsPopover
            codex={codex}
            loading={loading}
            lastFetchedAtMs={lastFetchedAtMs}
            onRefresh={onRefresh}
          />
        </div>
      )}
    </div>
  );
}

export default UsageLimitsButtonPresentational;
