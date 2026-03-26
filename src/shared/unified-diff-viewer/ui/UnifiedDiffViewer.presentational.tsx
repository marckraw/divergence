import { useMemo, type ReactNode } from "react";
import type { ParsedDiffLine } from "../../lib/unifiedDiff.pure";
import { parseUnifiedDiffLines } from "../../lib/unifiedDiff.pure";
import { cn } from "../../lib/cn.pure";
import { getDiffLineClass } from "../../lib/quickEdit.pure";
import LoadingSpinner from "../../ui/LoadingSpinner.presentational";

interface UnifiedDiffViewerProps {
  diff: string | null;
  lines?: ParsedDiffLine[];
  isBinary: boolean;
  isLoading: boolean;
  error: string | null;
  className?: string;
  plainLineClassName?: string;
  getLineRowClassName?: (line: ParsedDiffLine) => string | null | undefined;
  getLineTextClassName?: (line: ParsedDiffLine) => string | null | undefined;
  getLineKey?: (line: ParsedDiffLine) => string | number;
  header?: ReactNode;
  loadingContent?: ReactNode;
  emptyContent?: ReactNode;
  binaryContent?: ReactNode;
  errorContent?: ReactNode | ((error: string) => ReactNode);
  renderLineAside?: (line: ParsedDiffLine) => ReactNode;
  renderLineFooter?: (line: ParsedDiffLine) => ReactNode;
}

function UnifiedDiffViewer({
  diff,
  lines,
  isBinary,
  isLoading,
  error,
  className,
  plainLineClassName = "px-3",
  getLineRowClassName,
  getLineTextClassName,
  getLineKey,
  header = null,
  loadingContent,
  emptyContent,
  binaryContent,
  errorContent,
  renderLineAside,
  renderLineFooter,
}: UnifiedDiffViewerProps) {
  const parsedLines = useMemo(() => lines ?? parseUnifiedDiffLines(diff), [diff, lines]);

  if (isLoading) {
    return loadingContent ?? (
      <div className="flex h-full items-center justify-center text-sm text-subtext">
        <LoadingSpinner>Loading diff...</LoadingSpinner>
      </div>
    );
  }

  if (error) {
    if (typeof errorContent === "function") {
      return <>{errorContent(error)}</>;
    }

    return errorContent ?? (
      <div className="flex h-full items-center justify-center px-6 text-sm text-red">
        {error}
      </div>
    );
  }

  if (isBinary) {
    return binaryContent ?? (
      <div className="flex h-full items-center justify-center px-6 text-sm text-subtext">
        Binary file diff is not available.
      </div>
    );
  }

  if (!diff) {
    return emptyContent ?? (
      <div className="flex h-full items-center justify-center px-6 text-sm text-subtext">
        No diff available.
      </div>
    );
  }

  return (
    <div className={cn("h-full w-full overflow-auto font-mono text-[11px] leading-5", className)}>
      {header}
      {parsedLines.map((line) => {
        const key = getLineKey?.(line) ?? line.index;
        const aside = renderLineAside?.(line);
        const footer = renderLineFooter?.(line);

        return (
          <div key={key}>
            <div
              className={cn(
                aside ? "group/line flex w-full items-start gap-2 rounded px-2 transition-colors" : undefined,
                getLineRowClassName?.(line),
              )}
            >
              <div
                className={cn(
                  "whitespace-pre",
                  aside ? "flex-1 px-1" : plainLineClassName,
                  getDiffLineClass(line.text),
                  getLineTextClassName?.(line),
                )}
              >
                {line.text === "" ? " " : line.text}
              </div>
              {aside}
            </div>
            {footer}
          </div>
        );
      })}
    </div>
  );
}

export type { ParsedDiffLine };
export default UnifiedDiffViewer;
