type NoticeToastProps = {
  message: string | null;
  onDismiss: () => void;
};

export default function NoticeToast({
  message,
  onDismiss,
}: NoticeToastProps) {
  if (!message) return null;

  return (
    <div className="fixed top-4 left-4 right-4 z-[60] mx-auto max-w-md">
      <div
        role="status"
        aria-live="polite"
        className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 shadow-lg"
      >
        <span>{message}</span>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss message"
          className="shrink-0 rounded-lg p-1 text-emerald-700 hover:text-emerald-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        >
          <span aria-hidden="true">✕</span>
        </button>
      </div>
    </div>
  );
}
