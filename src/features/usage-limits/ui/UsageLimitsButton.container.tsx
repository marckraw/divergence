import { useCallback, useEffect, useRef, useState } from "react";
import { useUsageLimits } from "../model/useUsageLimits";
import {
  getSummaryUsageLevel,
  getUsageLevelColor,
} from "../model/usageLimits.pure";
import UsageLimitsButtonPresentational from "./UsageLimitsButton.presentational";

function UsageLimitsButton() {
  const { codex, loading, lastFetchedAtMs, refresh } = useUsageLimits();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const summaryLevel = getSummaryUsageLevel(codex);
  const dotColor = getUsageLevelColor(summaryLevel);

  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  return (
    <UsageLimitsButtonPresentational
      containerRef={containerRef}
      isOpen={isOpen}
      dotColor={dotColor}
      showDot={Boolean(lastFetchedAtMs)}
      onToggle={toggle}
      codex={codex}
      loading={loading}
      lastFetchedAtMs={lastFetchedAtMs}
      onRefresh={refresh}
    />
  );
}

export default UsageLimitsButton;
