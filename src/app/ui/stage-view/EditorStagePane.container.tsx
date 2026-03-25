import type { EditorSession } from "../../../entities";
import EditorSessionView from "../../../widgets/editor-session-view";
import type {
  EditorSessionRuntimeState,
  EditorSessionViewState,
} from "../../model/useEditorSessionRegistry";
import type { EditorThemeId } from "../../../shared";

interface EditorStagePaneProps {
  session: EditorSession;
  state: EditorSessionRuntimeState | null;
  viewState: EditorSessionViewState | null;
  editorTheme: EditorThemeId;
  onEnsureLoaded: (sessionId: string, options?: { force?: boolean }) => Promise<void>;
  onApplyViewState: (sessionId: string, viewState: EditorSessionViewState) => Promise<void>;
  onSetActiveTab: (
    sessionId: string,
    activeTab: EditorSessionRuntimeState["activeTab"],
  ) => void;
  onChangeContent: (sessionId: string, next: string) => void;
  onSave: (sessionId: string) => Promise<void>;
  onCloseSession: (sessionId: string) => void;
}

function EditorStagePane({
  session,
  state,
  viewState,
  editorTheme,
  onEnsureLoaded,
  onApplyViewState,
  onSetActiveTab,
  onChangeContent,
  onSave,
  onCloseSession,
}: EditorStagePaneProps) {
  const handleApplyViewState = async (
    sessionId: string,
    nextViewState: {
      preferredTab: "edit" | "diff";
      diffMode: "working" | "branch" | null;
      changeEntry: unknown;
      focusLine: number | null;
      focusColumn: number | null;
      requestKey: number;
    },
  ) => {
    await onApplyViewState(sessionId, nextViewState as EditorSessionViewState);
  };

  return (
    <EditorSessionView
      session={session}
      state={state}
      viewState={viewState}
      editorTheme={editorTheme}
      onEnsureLoaded={onEnsureLoaded}
      onApplyViewState={handleApplyViewState}
      onSetActiveTab={onSetActiveTab}
      onChangeContent={onChangeContent}
      onSave={onSave}
      onClose={onCloseSession}
    />
  );
}

export default EditorStagePane;
