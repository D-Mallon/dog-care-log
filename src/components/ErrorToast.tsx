type ErrorToastProps = {
  message: string | null;
  onDismiss: () => void;
};

export default function ErrorToast({ message, onDismiss }: ErrorToastProps) {
  if (!message) return null;

  return (
    <div className="fixed top-4 left-4 right-4 z-[60] mx-auto max-w-md">
      <div
        role="alert"
        className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 shadow-lg"
      >
        <span>{message}</span>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss error"
          className="shrink-0 rounded-lg p-1 text-rose-500 hover:text-rose-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
        >
          <span aria-hidden="true">✕</span>
        </button>
      </div>
    </div>
  );
}
