import type { ReactNode } from "react";

interface ChangesPanelPresentationalProps {
  children: ReactNode;
}

function ChangesPanelPresentational({ children }: ChangesPanelPresentationalProps) {
  return <>{children}</>;
}

export default ChangesPanelPresentational;
