import { Toaster as SonnerToaster } from "sonner";

function Toaster() {
  return (
    <SonnerToaster
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-sidebar group-[.toaster]:text-text group-[.toaster]:border-surface group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-subtext",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-surface group-[.toast]:text-subtext",
        },
      }}
    />
  );
}

export { Toaster };
