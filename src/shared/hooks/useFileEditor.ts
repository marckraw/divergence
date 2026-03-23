import { useCallback, useState } from "react";
import { getBranchDiff, getWorkingDiff } from "../api/git.api";
import { readTextFile, writeTextFile } from "../api/fs.api";
import type { ChangesMode, GitChangeEntry } from "../lib/gitChanges.pure";
import { joinPath } from "../lib/pathJoin.pure";
import { formatFileSize } from "../lib/quickEdit.pure";

export interface FileEditorOpenDiff {
  text: string;
  isBinary: boolean;
}

interface UseFileEditorParams {
  activeRootPath: string | null;
}

export function useFileEditor({ activeRootPath }: UseFileEditorParams) {
  const [openFilePath, setOpenFilePath] = useState<string | null>(null);
  const [openFileContent, setOpenFileContent] = useState("");
  const [openFileInitial, setOpenFileInitial] = useState("");
  const [fileLoadError, setFileLoadError] = useState<string | null>(null);
  const [fileSaveError, setFileSaveError] = useState<string | null>(null);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [isSavingFile, setIsSavingFile] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [largeFileWarning, setLargeFileWarning] = useState<string | null>(null);
  const [openDiff, setOpenDiff] = useState<FileEditorOpenDiff | null>(null);
  const [openDiffMode, setOpenDiffMode] = useState<ChangesMode | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [diffError, setDiffError] = useState<string | null>(null);
  const [drawerTab, setDrawerTab] = useState<"diff" | "edit">("edit");
  const [allowEdit, setAllowEdit] = useState(true);

  const isDrawerOpen = Boolean(openFilePath);
  const isDirty = openFileContent !== openFileInitial;

  const handleOpenFile = useCallback(async (
    path: string,
    options?: { resetDiff?: boolean; throwOnError?: boolean },
  ) => {
    const resetDiff = options?.resetDiff ?? true;
    const throwOnError = options?.throwOnError ?? false;

    if (resetDiff) {
      setOpenDiff(null);
      setOpenDiffMode(null);
      setDiffLoading(false);
      setDiffError(null);
      setDrawerTab("edit");
      setAllowEdit(true);
    }

    setOpenFilePath(path);
    setOpenFileContent("");
    setOpenFileInitial("");
    setFileLoadError(null);
    setFileSaveError(null);
    setIsReadOnly(false);
    setLargeFileWarning(null);
    setIsLoadingFile(true);

    try {
      const content = await readTextFile(path);
      setOpenFileContent(content);
      setOpenFileInitial(content);

      if (content.includes("\0")) {
        setIsReadOnly(true);
      }

      if (content.length > 2_000_000) {
        setLargeFileWarning(`Large file (${formatFileSize(content.length)}). Editing may be slow.`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to read file.";
      setFileLoadError(message);
      if (throwOnError) {
        throw error;
      }
    } finally {
      setIsLoadingFile(false);
    }
  }, []);

  const handleRemoveFile = useCallback((path: string) => {
    if (openFilePath !== path) {
      return;
    }

    setOpenFilePath(null);
    setOpenFileContent("");
    setOpenFileInitial("");
    setFileLoadError(null);
    setFileSaveError(null);
    setIsReadOnly(false);
    setLargeFileWarning(null);
    setOpenDiff(null);
    setOpenDiffMode(null);
    setDiffLoading(false);
    setDiffError(null);
    setDrawerTab("edit");
    setAllowEdit(true);
  }, [openFilePath]);

  const handleOpenChange = useCallback(async (entry: GitChangeEntry, mode: ChangesMode) => {
    if (!activeRootPath) {
      return;
    }

    const absolutePath = joinPath(activeRootPath, entry.path);
    const isDeleted = entry.status === "D";

    setDrawerTab("diff");
    setAllowEdit(!isDeleted && mode === "working");
    setOpenDiff(null);
    setOpenDiffMode(mode);
    setDiffLoading(true);
    setDiffError(null);

    if (isDeleted) {
      setOpenFilePath(absolutePath);
      setOpenFileContent("");
      setOpenFileInitial("");
      setFileLoadError(null);
      setFileSaveError(null);
      setIsReadOnly(true);
      setLargeFileWarning(null);
      setIsLoadingFile(false);
    } else {
      try {
        await handleOpenFile(absolutePath, { resetDiff: false, throwOnError: true });
      } catch (error) {
        setDiffError(error instanceof Error ? error.message : "Failed to load file.");
        setDiffLoading(false);
        return;
      }
    }

    try {
      const diff = mode === "branch"
        ? await getBranchDiff(activeRootPath, absolutePath)
        : await getWorkingDiff(activeRootPath, absolutePath);
      setOpenDiff({ text: diff.diff, isBinary: diff.isBinary });
    } catch (error) {
      setDiffError(error instanceof Error ? error.message : "Failed to load diff.");
    } finally {
      setDiffLoading(false);
    }
  }, [activeRootPath, handleOpenFile]);

  const handleCloseDrawer = useCallback(() => {
    if (isDirty) {
      const confirmClose = window.confirm("Discard unsaved changes?");
      if (!confirmClose) {
        return;
      }
    }

    setOpenFilePath(null);
    setOpenFileContent("");
    setOpenFileInitial("");
    setFileLoadError(null);
    setFileSaveError(null);
    setIsReadOnly(false);
    setLargeFileWarning(null);
    setOpenDiff(null);
    setOpenDiffMode(null);
    setDiffLoading(false);
    setDiffError(null);
    setDrawerTab("edit");
    setAllowEdit(true);
  }, [isDirty]);

  const handleSaveFile = useCallback(async () => {
    if (!openFilePath || isReadOnly || isSavingFile) {
      return;
    }

    setIsSavingFile(true);
    setFileSaveError(null);

    try {
      await writeTextFile(openFilePath, openFileContent);
      setOpenFileInitial(openFileContent);

      if (openDiff && activeRootPath) {
        setDiffLoading(true);
        setDiffError(null);
        try {
          const diff = openDiffMode === "branch"
            ? await getBranchDiff(activeRootPath, openFilePath)
            : await getWorkingDiff(activeRootPath, openFilePath);
          setOpenDiff({ text: diff.diff, isBinary: diff.isBinary });
        } catch (error) {
          setDiffError(error instanceof Error ? error.message : "Failed to refresh diff.");
          console.warn("Failed to refresh diff:", error);
        } finally {
          setDiffLoading(false);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save file.";
      setFileSaveError(message);
    } finally {
      setIsSavingFile(false);
    }
  }, [activeRootPath, isReadOnly, isSavingFile, openDiff, openDiffMode, openFileContent, openFilePath]);

  const handleLoadDiffForCurrentFile = useCallback(async (mode: ChangesMode) => {
    if (!activeRootPath || !openFilePath) {
      return;
    }

    setDrawerTab("diff");
    setAllowEdit(mode === "working" && !isReadOnly);
    setOpenDiff(null);
    setOpenDiffMode(mode);
    setDiffLoading(true);
    setDiffError(null);

    try {
      const diff = mode === "branch"
        ? await getBranchDiff(activeRootPath, openFilePath)
        : await getWorkingDiff(activeRootPath, openFilePath);
      setOpenDiff({ text: diff.diff, isBinary: diff.isBinary });
    } catch (error) {
      setDiffError(error instanceof Error ? error.message : "Failed to load diff.");
    } finally {
      setDiffLoading(false);
    }
  }, [activeRootPath, isReadOnly, openFilePath]);

  const handleChangeContent = useCallback((next: string) => {
    setOpenFileContent(next);
    if (fileSaveError) {
      setFileSaveError(null);
    }
  }, [fileSaveError]);

  const resetFileEditor = useCallback(() => {
    setOpenFilePath(null);
    setOpenFileContent("");
    setOpenFileInitial("");
    setFileLoadError(null);
    setFileSaveError(null);
    setIsLoadingFile(false);
    setIsSavingFile(false);
    setIsReadOnly(false);
    setLargeFileWarning(null);
    setOpenDiff(null);
    setOpenDiffMode(null);
    setDiffLoading(false);
    setDiffError(null);
    setDrawerTab("edit");
    setAllowEdit(true);
  }, []);

  return {
    openFilePath,
    openFileContent,
    openDiff,
    openDiffMode,
    diffLoading,
    diffError,
    drawerTab,
    allowEdit,
    isDrawerOpen,
    isDirty,
    isSavingFile,
    isLoadingFile,
    isReadOnly,
    fileLoadError,
    fileSaveError,
    largeFileWarning,
    handleOpenFile,
    handleRemoveFile,
    handleOpenChange,
    handleCloseDrawer,
    handleSaveFile,
    handleLoadDiffForCurrentFile,
    handleChangeContent,
    resetFileEditor,
  };
}
