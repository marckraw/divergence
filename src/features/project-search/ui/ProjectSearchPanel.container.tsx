import { useEffect, useRef, useState } from "react";
import { searchProjectFiles, type ProjectSearchResult } from "../api/projectSearch.api";
import ProjectSearchPanelPresentational from "./ProjectSearchPanel.presentational";

interface ProjectSearchPanelProps {
  rootPath: string | null;
  onOpenMatch: (absolutePath: string, lineNumber: number, columnStart: number) => void;
}

const MIN_QUERY_LENGTH = 2;
const SEARCH_DEBOUNCE_MS = 250;

function ProjectSearchPanel({ rootPath, onOpenMatch }: ProjectSearchPanelProps) {
  const [query, setQuery] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [result, setResult] = useState<ProjectSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const trimmedQuery = query.trim();

  useEffect(() => {
    requestIdRef.current += 1;

    if (!rootPath || trimmedQuery.length < MIN_QUERY_LENGTH) {
      setResult(null);
      setLoading(false);
      setError(null);
      return;
    }

    const requestId = requestIdRef.current;
    setLoading(true);
    setError(null);

    const timeoutId = window.setTimeout(() => {
      void searchProjectFiles(rootPath, trimmedQuery, {
        caseSensitive,
      })
        .then((nextResult) => {
          if (requestIdRef.current !== requestId) {
            return;
          }
          setResult(nextResult);
          setError(null);
        })
        .catch((nextError: unknown) => {
          if (requestIdRef.current !== requestId) {
            return;
          }
          setResult(null);
          setError(nextError instanceof Error ? nextError.message : "Failed to search project files.");
        })
        .finally(() => {
          if (requestIdRef.current === requestId) {
            setLoading(false);
          }
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [caseSensitive, rootPath, trimmedQuery]);

  return (
    <ProjectSearchPanelPresentational
      rootPath={rootPath}
      query={query}
      caseSensitive={caseSensitive}
      loading={loading}
      error={error}
      result={result}
      minQueryLength={MIN_QUERY_LENGTH}
      onQueryChange={setQuery}
      onToggleCaseSensitive={() => setCaseSensitive((previous) => !previous)}
      onClear={() => {
        requestIdRef.current += 1;
        setQuery("");
        setResult(null);
        setLoading(false);
        setError(null);
      }}
      onOpenMatch={onOpenMatch}
    />
  );
}

export default ProjectSearchPanel;
