import { useCallback, useState } from "react";
import type { ChangesMode, GitChangeEntry } from "../../../entities";
import type { MainAreaOpenDiff } from "../ui/MainArea.types";
import { readTextFile, writeTextFile } from "../../../shared/api/fs.api";
import { formatBytes, joinSessionPath } from "../lib/mainArea.pure";
import { getBranchDiff, getWorkingDiff } from "../api/mainArea.api";

interface UseFileEditorParams {
  activeRootPath: string | null;
  changesMode: ChangesMode;
}

export function useFileEditor({ activeRootPath, changesMode }: UseFileEditorParams) {
  const [openFilePath, setOpenFilePath] = useState<string | null>(null);
  const [openFileContent, setOpenFileContent] = useState("");
  const [openFileInitial, setOpenFileInitial] = useState("");
  const [fileLoadError, setFileLoadError] = useState<string | null>(null);
  const [fileSaveError, setFileSaveError] = useState<string | null>(null);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [isSavingFile, setIsSavingFile] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [largeFileWarning, setLargeFileWarning] = useState<string | null>(null);
  const [openDiff, setOpenDiff] = useState<MainAreaOpenDiff | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [diffError, setDiffError] = useState<string | null>(null);
  const [drawerTab, setDrawerTab] = useState<"diff" | "edit">("edit");
  const [allowEdit, setAllowEdit] = useState(true);

  const isDrawerOpen = Boolean(openFilePath);
  const isDirty = openFileContent !== openFileInitial;

  const handleOpenFile = useCallback(async (
    path: string,
    options?: { resetDiff?: boolean; throwOnError?: boolean }
  ) => {
    const resetDiff = options?.resetDiff ?? true;
    const throwOnError = options?.throwOnError ?? false;
    if (resetDiff) {
      setOpenDiff(null);
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

      const contentBytes = content.length;
      if (contentBytes > 2_000_000) {
        setLargeFileWarning(
          `Large file (${formatBytes(contentBytes)}). Editing may be slow.`
        );
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
    setDiffLoading(false);
    setDiffError(null);
    setDrawerTab("edit");
    setAllowEdit(true);
  }, [openFilePath]);

  const handleOpenChange = useCallback(async (entry: GitChangeEntry) => {
    if (!activeRootPath) {
      return;
    }

    const absolutePath = joinSessionPath(activeRootPath, entry.path);
    const isDeleted = entry.status === "D";

    setDrawerTab("diff");
    setAllowEdit(!isDeleted && changesMode === "working");
    setOpenDiff(null);
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
      if (changesMode === "branch") {
        const diff = await getBranchDiff(activeRootPath, absolutePath);
        setOpenDiff({ text: diff.diff, isBinary: diff.isBinary });
      } else {
        const diff = await getWorkingDiff(activeRootPath, absolutePath);
        setOpenDiff({ text: diff.diff, isBinary: diff.isBinary });
      }
    } catch (error) {
      setDiffError(error instanceof Error ? error.message : "Failed to load diff.");
    } finally {
      setDiffLoading(false);
    }
  }, [activeRootPath, changesMode, handleOpenFile]);

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
          const diff = await getWorkingDiff(activeRootPath, openFilePath);
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
  }, [activeRootPath, isReadOnly, isSavingFile, openDiff, openFileContent, openFilePath]);

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
    setDiffLoading(false);
    setDiffError(null);
    setDrawerTab("edit");
    setAllowEdit(true);
  }, []);

  return {
    openFilePath,
    openFileContent,
    openDiff,
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
    handleChangeContent,
    resetFileEditor,
  };
}
