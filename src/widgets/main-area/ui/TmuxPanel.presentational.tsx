import type { ReactNode } from "react";

interface TmuxPanelPresentationalProps {
  children: ReactNode;
}

function TmuxPanelPresentational({ children }: TmuxPanelPresentationalProps) {
  return <>{children}</>;
}

export default TmuxPanelPresentational;
