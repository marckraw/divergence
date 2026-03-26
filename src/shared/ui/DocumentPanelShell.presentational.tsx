import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn.pure";

export interface DocumentPanelShellProps
  extends HTMLAttributes<HTMLDivElement> {
  header?: ReactNode;
  tabs?: ReactNode;
  banners?: ReactNode;
  bodyClassName?: string;
  children: ReactNode;
}

function DocumentPanelShell({
  header,
  tabs,
  banners,
  bodyClassName,
  children,
  className,
  ...rest
}: DocumentPanelShellProps) {
  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)} {...rest}>
      {header}
      {tabs}
      {banners}
      <div className={cn("flex-1 min-h-0", bodyClassName)}>{children}</div>
    </div>
  );
}

export default DocumentPanelShell;
