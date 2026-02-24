import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn.pure";
import IconButton from "./IconButton.presentational";

export interface ModalHeaderProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  title: ReactNode;
  description?: ReactNode;
  onClose?: () => void;
  closeDisabled?: boolean;
}

function ModalHeader({
  title,
  description,
  onClose,
  closeDisabled,
  className,
  ...rest
}: ModalHeaderProps) {
  return (
    <div
      className={cn(
        "px-4 py-3 border-b border-surface flex items-center justify-between gap-3",
        className,
      )}
      {...rest}
    >
      <div>
        <h3 className="text-sm text-text font-semibold">{title}</h3>
        {description && <p className="text-xs text-subtext mt-1">{description}</p>}
      </div>
      {onClose && (
        <IconButton
          onClick={onClose}
          variant="subtle"
          size="sm"
          disabled={closeDisabled}
          label="Close"
          icon="x"
        />
      )}
    </div>
  );
}

export default ModalHeader;
