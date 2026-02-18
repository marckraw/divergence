import type { DebugEvent } from "../../../shared";
import type {
  DebugCategoryFilter,
  DebugLevelFilter,
} from "../lib/debugConsole.pure";

export interface DebugConsolePanelProps {
  events: DebugEvent[];
  totalCount: number;
  visibleCount: number;
  infoCount: number;
  warnCount: number;
  errorCount: number;
  searchQuery: string;
  levelFilter: DebugLevelFilter;
  categoryFilter: DebugCategoryFilter;
  onlyFailureOrStuck: boolean;
  copyState: "idle" | "copied" | "error";
  onSearchQueryChange: (value: string) => void;
  onLevelFilterChange: (value: DebugLevelFilter) => void;
  onCategoryFilterChange: (value: DebugCategoryFilter) => void;
  onToggleOnlyFailureOrStuck: () => void;
  onResetFilters: () => void;
  onRefreshTmuxDiagnostics: () => Promise<void>;
  onCopyJson: () => Promise<void>;
  onClear: () => void;
}
