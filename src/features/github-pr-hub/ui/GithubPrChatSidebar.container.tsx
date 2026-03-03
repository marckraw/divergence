import type {
  GithubPrChatAgent,
  GithubPrChatMessage,
} from "../model/githubPrChat.types";
import GithubPrChatSidebarPresentational from "./GithubPrChatSidebar.presentational";

interface GithubPrChatSidebarContainerProps {
  messages: GithubPrChatMessage[];
  draft: string;
  selectedAgent: GithubPrChatAgent;
  includeAllPatches: boolean;
  sending: boolean;
  error: string | null;
  onDraftChange: (value: string) => void;
  onSelectedAgentChange: (value: GithubPrChatAgent) => void;
  onIncludeAllPatchesChange: (value: boolean) => void;
  onSend: () => Promise<boolean>;
  onClear: () => void;
}

function GithubPrChatSidebarContainer(props: GithubPrChatSidebarContainerProps) {
  return (
    <GithubPrChatSidebarPresentational
      messages={props.messages}
      draft={props.draft}
      selectedAgent={props.selectedAgent}
      includeAllPatches={props.includeAllPatches}
      sending={props.sending}
      error={props.error}
      onDraftChange={props.onDraftChange}
      onSelectedAgentChange={props.onSelectedAgentChange}
      onIncludeAllPatchesChange={props.onIncludeAllPatchesChange}
      onSend={props.onSend}
      onClear={props.onClear}
    />
  );
}

export default GithubPrChatSidebarContainer;
