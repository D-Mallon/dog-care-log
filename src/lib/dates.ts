/** Format a date for an <input type="datetime-local"> in the user's local time. */
export function toDateTimeLocalValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Parse a datetime-local value into an ISO timestamp.
 * Returns null for empty or invalid input.
 */
export function fromDateTimeLocalValue(value: string): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

/** True when the parsed value is in the future (with a small clock-skew grace). */
export function isFutureDateTime(
  value: string,
  now: Date = new Date(),
  graceMs = 60_000,
): boolean {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.getTime() > now.getTime() + graceMs;
}

export function formatDateTimeLocalLabel(iso: string): string {
  return new Date(iso).toLocaleString([], {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Whole hours between two timestamps, rounded to one decimal place. */
export function hoursBetween(earlierIso: string, laterIso: string): number {
  const diff =
    new Date(laterIso).getTime() - new Date(earlierIso).getTime();
  return Math.round((diff / 3_600_000) * 10) / 10;
}

export function formatDurationHours(hours: number): string {
  if (!Number.isFinite(hours)) return "—";
  if (hours < 1) return `${Math.max(0, Math.round(hours * 60))}m`;
  if (hours < 24) return `${Math.round(hours * 10) / 10}h`;
  const days = Math.floor(hours / 24);
  const remainder = Math.round(hours % 24);
  return remainder === 0 ? `${days}d` : `${days}d ${remainder}h`;
}
