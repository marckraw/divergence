import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, MouseEvent } from "react";
import {
  filterFilesByQuery,
  joinRootWithRelativePath,
} from "../../../lib/utils/fileQuickSwitcher";
import { listProjectFiles } from "../api/fileQuickSwitcher.api";
import FileQuickSwitcherPresentational from "./FileQuickSwitcher.presentational";
import type { FileQuickSwitcherProps } from "./FileQuickSwitcher.types";

const MAX_RENDERED = 200;

function FileQuickSwitcherContainer({ rootPath, onSelect, onClose }: FileQuickSwitcherProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [files, setFiles] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [truncated, setTruncated] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    listProjectFiles(rootPath)
      .then((result) => {
        if (cancelled) {
          return;
        }
        setFiles(result.files);
        setTruncated(result.truncated);
        setIsLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) {
          return;
        }
        setError(typeof err === "string" ? err : "Failed to list files.");
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [rootPath]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const filteredFiles = useMemo(() => {
    return filterFilesByQuery(files, query);
  }, [files, query]);

  const displayFiles = filteredFiles.slice(0, MAX_RENDERED);
  const overflowCount = filteredFiles.length - displayFiles.length;

  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredFiles]);

  useEffect(() => {
    const list = listRef.current;
    if (!list || displayFiles.length === 0) {
      return;
    }

    const item = list.children[selectedIndex] as HTMLElement;
    item?.scrollIntoView({ block: "nearest" });
  }, [displayFiles.length, selectedIndex]);

  const selectFile = useCallback((relativePath: string) => {
    onSelect(joinRootWithRelativePath(rootPath, relativePath));
  }, [onSelect, rootPath]);

  const handleInputKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setSelectedIndex((previous) => (
          previous < displayFiles.length - 1 ? previous + 1 : previous
        ));
        break;
      case "ArrowUp":
        event.preventDefault();
        setSelectedIndex((previous) => (previous > 0 ? previous - 1 : previous));
        break;
      case "Enter":
        event.preventDefault();
        if (displayFiles[selectedIndex]) {
          selectFile(displayFiles[selectedIndex]);
        }
        break;
      case "Escape":
        event.preventDefault();
        onClose();
        break;
    }
  }, [displayFiles, onClose, selectFile, selectedIndex]);

  const handlePanelClick = useCallback((event: MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
  }, []);

  return (
    <FileQuickSwitcherPresentational
      query={query}
      selectedIndex={selectedIndex}
      filteredCount={filteredFiles.length}
      displayFiles={displayFiles}
      overflowCount={overflowCount}
      isLoading={isLoading}
      error={error}
      truncated={truncated}
      inputRef={inputRef}
      listRef={listRef}
      onClose={onClose}
      onPanelClick={handlePanelClick}
      onQueryChange={setQuery}
      onInputKeyDown={handleInputKeyDown}
      onSelectFile={selectFile}
      onHoverIndex={setSelectedIndex}
    />
  );
}

export default FileQuickSwitcherContainer;
