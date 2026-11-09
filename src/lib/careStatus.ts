import type { EventType } from "../types/core.ts";

export type CareUrgency = "no-record" | "ok" | "due-soon" | "overdue";

type CareThreshold = {
  dueAfterHours: number;
  overdueAfterHours: number;
};

/**
 * Defaults for Release 1. These are deliberately conservative and will become
 * per-household settings later.
 */
export const CARE_THRESHOLDS: Partial<Record<EventType, CareThreshold>> = {
  feed: { dueAfterHours: 10, overdueAfterHours: 14 },
  walk: { dueAfterHours: 6, overdueAfterHours: 10 },
  toilet: { dueAfterHours: 4, overdueAfterHours: 7 },
  meds: { dueAfterHours: 20, overdueAfterHours: 26 },
};

export function getCareUrgency(
  lastTimestamp: string | null,
  eventType: EventType,
  now: Date = new Date(),
): CareUrgency {
  const threshold = CARE_THRESHOLDS[eventType];
  if (!lastTimestamp || !threshold) return "no-record";

  const last = new Date(lastTimestamp).getTime();
  if (Number.isNaN(last)) return "no-record";

  const hoursSince = (now.getTime() - last) / 3_600_000;
  if (hoursSince >= threshold.overdueAfterHours) return "overdue";
  if (hoursSince >= threshold.dueAfterHours) return "due-soon";
  return "ok";
}

export function careUrgencyLabel(urgency: CareUrgency): string {
  switch (urgency) {
    case "overdue":
      return "Overdue";
    case "due-soon":
      return "Due soon";
    case "ok":
      return "Up to date";
    case "no-record":
    default:
      return "No record";
  }
}

export function careUrgencyClasses(urgency: CareUrgency): string {
  switch (urgency) {
    case "overdue":
      return "border-rose-300 bg-rose-50 text-rose-800";
    case "due-soon":
      return "border-amber-300 bg-amber-50 text-amber-900";
    case "ok":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "no-record":
    default:
      return "border-warm-brown/15 bg-cream text-text-muted";
  }
}
