import { Button, EmptyState, LoadingSpinner, TextInput } from "../../../shared";
import type {
  ProjectSearchFileResult,
  ProjectSearchResult,
} from "../api/projectSearch.api";

interface ProjectSearchPanelPresentationalProps {
  rootPath: string | null;
  query: string;
  caseSensitive: boolean;
  loading: boolean;
  error: string | null;
  result: ProjectSearchResult | null;
  minQueryLength: number;
  onQueryChange: (query: string) => void;
  onToggleCaseSensitive: () => void;
  onClear: () => void;
  onOpenMatch: (absolutePath: string, lineNumber: number, columnStart: number) => void;
}

function renderPreview(preview: string, columnStart: number, columnEnd: number) {
  const startIndex = Math.max(0, columnStart - 1);
  const endIndex = Math.max(startIndex, columnEnd);

  return (
    <>
      {preview.slice(0, startIndex)}
      <mark className="rounded bg-accent/20 px-0.5 text-text">
        {preview.slice(startIndex, endIndex)}
      </mark>
      {preview.slice(endIndex)}
    </>
  );
}

function renderFileMatches(
  file: ProjectSearchFileResult,
  onOpenMatch: (absolutePath: string, lineNumber: number, columnStart: number) => void,
) {
  return (
    <section key={file.absolutePath} className="overflow-hidden rounded border border-surface bg-main/40">
      <div className="border-b border-surface px-3 py-2">
        <p className="truncate text-xs text-text">{file.filePath}</p>
      </div>
      <div className="divide-y divide-surface/70">
        {file.matches.map((match) => (
          <Button
            key={`${file.absolutePath}-${match.lineNumber}-${match.columnStart}`}
            variant="ghost"
            size="xs"
            className="flex w-full flex-col items-start gap-1 px-3 py-2 text-left transition-colors hover:bg-surface/50"
            onClick={() => onOpenMatch(file.absolutePath, match.lineNumber, match.columnStart)}
          >
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-subtext">
              <span>Line {match.lineNumber}</span>
              <span>Col {match.columnStart}</span>
            </div>
            <div className="w-full overflow-hidden text-ellipsis whitespace-pre-wrap break-words font-mono text-[11px] leading-5 text-subtext">
              {renderPreview(match.preview, match.columnStart, match.columnEnd)}
            </div>
          </Button>
        ))}
      </div>
    </section>
  );
}

function ProjectSearchPanelPresentational({
  rootPath,
  query,
  caseSensitive,
  loading,
  error,
  result,
  minQueryLength,
  onQueryChange,
  onToggleCaseSensitive,
  onClear,
  onOpenMatch,
}: ProjectSearchPanelPresentationalProps) {
  const trimmedQuery = query.trim();
  const matchCount = result?.files.reduce((count, file) => count + file.matches.length, 0) ?? 0;

  if (!rootPath) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-sm text-subtext">
        Select a project to search its files.
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-surface px-3 py-3">
        <div className="flex items-center gap-2">
          <TextInput
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search in files"
            className="h-9"
          />
          <Button
            variant={caseSensitive ? "primary" : "ghost"}
            size="xs"
            onClick={onToggleCaseSensitive}
            className="shrink-0"
          >
            Match Case
          </Button>
          {trimmedQuery.length > 0 && (
            <Button variant="ghost" size="xs" onClick={onClear} className="shrink-0 text-subtext hover:text-text">
              Clear
            </Button>
          )}
        </div>
        <div className="mt-2 flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.14em] text-subtext">
          <span className="truncate">{rootPath}</span>
          {loading ? <span>Searching...</span> : result ? <span>{matchCount} matches</span> : null}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3">
        {trimmedQuery.length === 0 ? (
          <EmptyState className="px-2 text-xs">
            Enter a search query to scan the current project.
          </EmptyState>
        ) : trimmedQuery.length < minQueryLength ? (
          <EmptyState className="px-2 text-xs">
            Type at least {minQueryLength} characters to search.
          </EmptyState>
        ) : error ? (
          <div className="rounded border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300/90">
            {error}
          </div>
        ) : loading && !result ? (
          <div className="flex h-full items-center justify-center text-sm text-subtext">
            <LoadingSpinner>Searching files...</LoadingSpinner>
          </div>
        ) : result && result.files.length > 0 ? (
          <div className="space-y-3">
            {result.files.map((file) => renderFileMatches(file, onOpenMatch))}
            {result.truncated && (
              <div className="rounded border border-yellow-400/20 bg-yellow-400/10 px-3 py-2 text-xs text-yellow-200/90">
                Search results were truncated. Refine the query to narrow the result set.
              </div>
            )}
          </div>
        ) : (
          <EmptyState className="px-2 text-xs">
            No matches found for "{trimmedQuery}".
          </EmptyState>
        )}
      </div>
    </div>
  );
}

export default ProjectSearchPanelPresentational;
