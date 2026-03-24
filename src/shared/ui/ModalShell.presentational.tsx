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
  onPanelAnimationComplete?: () => void;
  onOverlayExitComplete?: () => void;
  /** Marks the overlay root for queries (e.g. excluding modal content from “previously focused” capture). */
  dataCommandCenterRoot?: boolean;
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
  onPanelAnimationComplete,
  onOverlayExitComplete,
  dataCommandCenterRoot,
}: ModalShellProps) {
  return (
    <ModalOverlay
      className={overlayClassName}
      {...(dataCommandCenterRoot ? { "data-command-center-root": "" } : {})}
      onExitComplete={onOverlayExitComplete}
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
        onAnimationComplete={onPanelAnimationComplete}
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
