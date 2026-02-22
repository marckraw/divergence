import type { MouseEvent, ReactNode } from "react";
import type { ModalSize, ModalSurface } from "./modal.styles";
import ModalOverlay from "./ModalOverlay.presentational";
import ModalPanel from "./ModalPanel.presentational";

export interface ModalShellProps {
  children: ReactNode;
  onRequestClose?: () => void;
  closeOnOverlayClick?: boolean;
  overlayClassName?: string;
  panelClassName?: string;
  size?: ModalSize;
  surface?: ModalSurface;
  onPanelClick?: (event: MouseEvent<HTMLDivElement>) => void;
}

function ModalShell({
  children,
  onRequestClose,
  closeOnOverlayClick = true,
  overlayClassName,
  panelClassName,
  size = "md",
  surface = "sidebar",
  onPanelClick,
}: ModalShellProps) {
  return (
    <ModalOverlay
      className={overlayClassName}
      onClick={() => {
        if (closeOnOverlayClick) {
          onRequestClose?.();
        }
      }}
    >
      <ModalPanel
        size={size}
        surface={surface}
        className={panelClassName}
        onClick={(event) => {
          event.stopPropagation();
          onPanelClick?.(event);
        }}
      >
        {children}
      </ModalPanel>
    </ModalOverlay>
  );
}

export default ModalShell;
