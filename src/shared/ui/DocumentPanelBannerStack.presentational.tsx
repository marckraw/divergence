import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn.pure";

export interface DocumentPanelBannerItem {
  id: string;
  tone: "warning" | "error";
  message: ReactNode;
  action?: ReactNode;
}

export interface DocumentPanelBannerStackProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  items: DocumentPanelBannerItem[];
}

function DocumentPanelBannerStack({
  items,
  className,
  ...rest
}: DocumentPanelBannerStackProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className={className} {...rest}>
      {items.map((item) => {
        const toneClassName =
          item.tone === "warning"
            ? "border-b border-yellow-400/20 bg-yellow-400/10 text-yellow-200/90"
            : "border-b border-red-500/20 bg-red-500/10 text-red-300/90";

        return (
          <div
            key={item.id}
            className={cn(
              "px-4 py-2 text-[11px]",
              item.action
                ? "flex items-center justify-between gap-3"
                : undefined,
              toneClassName
            )}
          >
            <span className={cn(item.action ? "min-w-0 flex-1 break-all" : undefined)}>
              {item.message}
            </span>
            {item.action ? <div className="shrink-0">{item.action}</div> : null}
          </div>
        );
      })}
    </div>
  );
}

export default DocumentPanelBannerStack;
