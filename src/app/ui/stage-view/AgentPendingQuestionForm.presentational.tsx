import type { AgentRequest } from "../../../entities/agent-session";
import { Button, Textarea } from "../../../shared";

interface AgentPendingQuestionFormProps {
  request: AgentRequest;
  answers: string[];
  isResolving: boolean;
  canSubmit: boolean;
  onAnswerChange: (index: number, value: string) => void;
  onSubmit: () => void;
}

function AgentPendingQuestionForm({
  request,
  answers,
  isResolving,
  canSubmit,
  onAnswerChange,
  onSubmit,
}: AgentPendingQuestionFormProps) {
  return (
    <div className="border-b border-surface bg-sidebar/40 px-5 py-4">
      <div className="mx-auto mt-0 w-full max-w-5xl space-y-3">
        {request.questions?.map((question, index) => (
          <div key={question.id} className="rounded-xl border border-surface bg-main/60 px-3 py-3">
            <p className="text-[10px] uppercase tracking-[0.18em] text-subtext">{question.header}</p>
            <p className="mt-1 text-sm text-text">{question.question}</p>
            {question.options && question.options.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {question.options.map((option) => {
                  const isSelected = answers[index] === option.label;
                  return (
                    <Button
                      key={option.id}
                      type="button"
                      variant={isSelected ? "secondary" : "ghost"}
                      size="sm"
                      onClick={() => onAnswerChange(index, option.label)}
                      disabled={isResolving}
                      title={option.description}
                    >
                      {option.label}
                    </Button>
                  );
                })}
              </div>
            ) : null}
            <Textarea
              value={answers[index] ?? ""}
              onChange={(event) => onAnswerChange(index, event.target.value)}
              placeholder={question.isSecret ? "Enter hidden value" : "Enter response"}
              className="mt-3 min-h-[88px]"
            />
          </div>
        ))}
        <div className="flex justify-end">
          <Button type="button" onClick={onSubmit} disabled={isResolving || !canSubmit}>
            {isResolving ? "Submitting..." : "Submit Answers"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default AgentPendingQuestionForm;
