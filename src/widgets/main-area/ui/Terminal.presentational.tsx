import type { ReactNode } from "react";

interface TerminalPresentationalProps {
  children: ReactNode;
}

function TerminalPresentational({ children }: TerminalPresentationalProps) {
  return <>{children}</>;
}

export default TerminalPresentational;
