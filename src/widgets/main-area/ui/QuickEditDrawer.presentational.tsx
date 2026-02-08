import type { ReactNode } from "react";

interface QuickEditDrawerPresentationalProps {
  children: ReactNode;
}

function QuickEditDrawerPresentational({ children }: QuickEditDrawerPresentationalProps) {
  return <>{children}</>;
}

export default QuickEditDrawerPresentational;
