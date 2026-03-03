import { useCallback, useRef, useState } from "react";
import type { WorkSidebarMode, WorkSidebarTab } from "../../features/work-sidebar";

interface UseSidebarLayoutParams {
  onModeChange?: (mode: WorkSidebarMode) => void;
}

export function useSidebarLayout({ onModeChange }: UseSidebarLayoutParams = {}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(256);
  const [isDraggingSidebar, setIsDraggingSidebar] = useState(false);
  const [sidebarMode, setSidebarMode] = useState<WorkSidebarMode>("projects");
  const [workTab, setWorkTab] = useState<WorkSidebarTab>("inbox");
  const dragStartXRef = useRef(0);
  const dragStartWidthRef = useRef(0);

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen(prev => !prev);
  }, []);

  const toggleRightPanel = useCallback(() => {
    setIsRightPanelOpen(prev => !prev);
  }, []);

  const handleSidebarDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingSidebar(true);
    dragStartXRef.current = e.clientX;
    dragStartWidthRef.current = sidebarWidth;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - dragStartXRef.current;
      const newWidth = Math.min(480, Math.max(180, dragStartWidthRef.current + delta));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsDraggingSidebar(false);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [sidebarWidth]);

  const handleSidebarDragDoubleClick = useCallback(() => {
    setSidebarWidth(256);
  }, []);

  const handleSidebarModeChange = useCallback((mode: WorkSidebarMode) => {
    setSidebarMode(mode);
    if (mode === "work" || mode === "workspaces") {
      onModeChange?.(mode);
    }
  }, [onModeChange]);

  const handleWorkTabChange = useCallback((tab: WorkSidebarTab) => {
    setSidebarMode("work");
    setWorkTab(tab);
  }, []);

  return {
    isSidebarOpen,
    setIsSidebarOpen,
    isRightPanelOpen,
    setIsRightPanelOpen,
    sidebarWidth,
    isDraggingSidebar,
    sidebarMode,
    setSidebarMode,
    workTab,
    setWorkTab,
    toggleSidebar,
    toggleRightPanel,
    handleSidebarDragStart,
    handleSidebarDragDoubleClick,
    handleSidebarModeChange,
    handleWorkTabChange,
  };
}
