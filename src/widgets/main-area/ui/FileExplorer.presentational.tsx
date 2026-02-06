import type { ReactNode } from "react";

interface FileExplorerPresentationalProps {
  children: ReactNode;
}

function FileExplorerPresentational({ children }: FileExplorerPresentationalProps) {
  return <>{children}</>;
}

export default FileExplorerPresentational;
