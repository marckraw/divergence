import type { BackgroundTaskToast } from "../types";

interface TaskToastsProps {
  toasts: BackgroundTaskToast[];
  onDismiss: (toastId: string) => void;
  onViewTask: (taskId: string) => void;
}

function TaskToasts({ toasts, onDismiss, onViewTask }: TaskToastsProps) {
  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-16 right-4 z-50 flex flex-col gap-2 w-80">
      {toasts.map((toast) => {
        const isError = toast.kind === "error";
        return (
          <div
            key={toast.id}
            className={`rounded-md border p-3 shadow-lg ${
              isError ? "bg-red/10 border-red/40" : "bg-sidebar border-surface"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <p className={`text-sm ${isError ? "text-red" : "text-text"}`}>{toast.message}</p>
              <button
                onClick={() => onDismiss(toast.id)}
                className="text-subtext hover:text-text"
                aria-label="Dismiss notification"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="mt-2 flex justify-end">
              <button
                onClick={() => onViewTask(toast.taskId)}
                className="text-xs px-2 py-1 rounded border border-surface text-text hover:bg-surface"
              >
                View task
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default TaskToasts;
