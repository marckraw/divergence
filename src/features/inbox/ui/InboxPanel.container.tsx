import InboxPanelPresentational from "./InboxPanel.presentational";
import type { InboxPanelProps } from "./InboxPanel.types";

function InboxPanelContainer(props: InboxPanelProps) {
  return <InboxPanelPresentational {...props} />;
}

export default InboxPanelContainer;
