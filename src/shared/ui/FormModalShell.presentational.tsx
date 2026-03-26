import type { ReactNode } from "react";
import ModalFooter from "./ModalFooter.presentational";
import ModalHeader from "./ModalHeader.presentational";
import ModalBody from "./ModalBody.presentational";
import ModalShell from "./ModalShell.presentational";
import type { ModalShellProps } from "./ModalShell.presentational";

export interface FormModalShellProps
  extends Pick<
    ModalShellProps,
    | "onRequestClose"
    | "closeOnOverlayClick"
    | "overlayClassName"
    | "panelClassName"
    | "size"
    | "surface"
  > {
  title: ReactNode;
  description?: ReactNode;
  closeDisabled?: boolean;
  body: ReactNode;
  footer?: ReactNode;
  bodyClassName?: string;
  scrollableBody?: boolean;
}

function FormModalShell({
  title,
  description,
  closeDisabled,
  body,
  footer,
  bodyClassName,
  scrollableBody = false,
  ...shellProps
}: FormModalShellProps) {
  return (
    <ModalShell {...shellProps}>
      <ModalHeader
        title={title}
        description={description}
        onClose={shellProps.onRequestClose}
        closeDisabled={closeDisabled}
      />
      <ModalBody className={bodyClassName} scrollable={scrollableBody}>
        {body}
      </ModalBody>
      {footer ? <ModalFooter>{footer}</ModalFooter> : null}
    </ModalShell>
  );
}

export default FormModalShell;
