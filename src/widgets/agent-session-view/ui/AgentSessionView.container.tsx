import { useCallback, useEffect, useState } from "react";
import AgentSessionViewPresentational from "./AgentSessionView.presentational";
import type { AgentSessionViewProps } from "./AgentSessionView.types";

function AgentSessionViewContainer(props: AgentSessionViewProps) {
  const [draft, setDraft] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUpdatingModel, setIsUpdatingModel] = useState(false);
  const [requestAnswers, setRequestAnswers] = useState<string[]>([]);
  const [isResolvingRequest, setIsResolvingRequest] = useState(false);

  useEffect(() => {
    setDraft("");
    setIsSubmitting(false);
    setIsUpdatingModel(false);
    setIsResolvingRequest(false);
  }, [props.session.id]);

  useEffect(() => {
    const questions = props.session.pendingRequest?.questions ?? [];
    setRequestAnswers(questions.map(() => ""));
    setIsResolvingRequest(false);
  }, [props.session.pendingRequest?.id, props.session.pendingRequest?.questions]);

  const handleSubmit = useCallback(async () => {
    const prompt = draft.trim();
    if (!prompt || isSubmitting || props.session.pendingRequest) {
      return;
    }

    setIsSubmitting(true);
    try {
      await props.onSendPrompt(props.session.id, prompt);
      setDraft("");
    } finally {
      setIsSubmitting(false);
    }
  }, [draft, isSubmitting, props]);

  const handleRequestAnswerChange = useCallback((index: number, value: string) => {
    setRequestAnswers((previous) => {
      const next = [...previous];
      next[index] = value;
      return next;
    });
  }, []);

  const handleModelChange = useCallback(async (model: string) => {
    if (!model.trim() || isUpdatingModel || model === props.session.model) {
      return;
    }

    setIsUpdatingModel(true);
    try {
      await props.onUpdateModel(props.session.id, model);
    } finally {
      setIsUpdatingModel(false);
    }
  }, [isUpdatingModel, props]);

  const handleSubmitRequest = useCallback(async () => {
    const request = props.session.pendingRequest;
    if (!request || request.kind !== "user-input" || isResolvingRequest) {
      return;
    }

    setIsResolvingRequest(true);
    try {
      await props.onRespondToRequest(props.session.id, request.id, {
        answers: requestAnswers,
      });
    } finally {
      setIsResolvingRequest(false);
    }
  }, [isResolvingRequest, props, requestAnswers]);

  const handleResolveApproval = useCallback(async (decisionId: string) => {
    const request = props.session.pendingRequest;
    if (!request || request.kind !== "approval" || isResolvingRequest) {
      return;
    }

    setIsResolvingRequest(true);
    try {
      await props.onRespondToRequest(props.session.id, request.id, {
        decision: decisionId,
      });
    } finally {
      setIsResolvingRequest(false);
    }
  }, [isResolvingRequest, props]);

  return (
    <AgentSessionViewPresentational
      {...props}
      draft={draft}
      isSubmitting={isSubmitting}
      isUpdatingModel={isUpdatingModel}
      requestAnswers={requestAnswers}
      isResolvingRequest={isResolvingRequest}
      onDraftChange={setDraft}
      onModelChange={handleModelChange}
      onRequestAnswerChange={handleRequestAnswerChange}
      onSubmit={handleSubmit}
      onSubmitRequest={handleSubmitRequest}
      onResolveApproval={handleResolveApproval}
    />
  );
}

export default AgentSessionViewContainer;
