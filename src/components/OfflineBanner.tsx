import { useOnlineStatus } from "../lib/useOnlineStatus.ts";

export default function OfflineBanner() {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-4 right-4 z-40 mx-auto max-w-md rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-center text-sm font-medium text-amber-900 shadow-lg"
    >
      You're offline. Logging is unavailable until you reconnect.
    </div>
  );
}
