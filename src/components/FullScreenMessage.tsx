type FullScreenMessageProps = {
  title: string;
  message: string;
  actionLabel: string;
  onAction: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
};

export default function FullScreenMessage({
  title,
  message,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
}: FullScreenMessageProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-cream p-6">
      <div className="w-full max-w-sm rounded-3xl border border-warm-brown/10 bg-white p-6 text-center shadow-sm">
        <div className="mb-3 text-4xl" aria-hidden="true">
          🐾
        </div>
        <h1 className="mb-2 text-xl font-bold font-fraunces text-warm-brown">
          {title}
        </h1>
        <p className="mb-5 text-sm text-text-muted">{message}</p>
        <button
          type="button"
          onClick={onAction}
          className="w-full rounded-xl bg-warm-brown py-3 text-sm font-semibold text-white hover:opacity-90"
        >
          {actionLabel}
        </button>
        {secondaryLabel && onSecondary && (
          <button
            type="button"
            onClick={onSecondary}
            className="mt-3 w-full rounded-xl border border-warm-brown/20 py-3 text-sm font-medium text-warm-brown hover:bg-light-tan"
          >
            {secondaryLabel}
          </button>
        )}
      </div>
    </div>
  );
}
